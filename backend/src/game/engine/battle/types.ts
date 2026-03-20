/*
 * POINT ZERO ONE — BACKEND ENGINE CORE
 * /backend/src/game/engine/battle/types.ts
 *
 * Doctrine:
 * - battle engine types must remain backend-authoritative and serialization-safe
 * - profiles are stable doctrine; runtime bot state lives in RunStateSnapshot
 * - pressure is semantic and normalized, heat is tactical and 0..100 scaled
 * - additive growth is preferred over breaking contract churn
 * - controller/runtime diagnostics should be explainable enough for replay, proof,
 *   tuning, and cross-engine narrative consumption
 */

import type {
  AttackCategory,
  AttackEvent,
  AttackTargetEntity,
  HaterBotId,
  ModeCode,
  ShieldLayerId,
} from '../core/GamePrimitives';
import type { BotRuntimeState } from '../core/RunStateSnapshot';

/**
 * Canonical threat band used by battle, chat, replay, and future telemetry.
 * These are additive semantics layered on top of the raw 0..100 composite threat.
 */
export type BotThreatBand =
  | 'DORMANT'
  | 'LOW'
  | 'WARM'
  | 'HOT'
  | 'CRITICAL'
  | 'TERMINAL';

/**
 * Intent is more granular than state. Two bots may both be TARGETING while having
 * different intent — one may be probing while another is closing for a breach.
 */
export type BotIntentCode =
  | 'RESET'
  | 'PROBE'
  | 'HARASS'
  | 'PIN'
  | 'EXTRACT'
  | 'LOCK'
  | 'DRAIN'
  | 'HEAT_SPIKE'
  | 'BREACH_SETUP'
  | 'CLOSE'
  | 'RETREAT';

/**
 * Momentum describes the current directional feel of the bot's hostility.
 */
export type BotMomentumDirection =
  | 'COOLING'
  | 'STABLE'
  | 'RISING'
  | 'SPIKING';

/**
 * Attack-window state lets callers separate “state machine says attacking” from
 * “runtime doctrine says the strike window is actually open.”
 */
export type BotAttackWindowState =
  | 'CLOSED'
  | 'PRESSURE_ONLY'
  | 'SOFT_OPEN'
  | 'OPEN'
  | 'FORCED';

/**
 * Retreat policy is surfaced explicitly so the battle engine, chat layer, or UI
 * can explain why a bot cooled off.
 */
export type BotRetreatDecision =
  | 'HOLD'
  | 'SOFT_RETREAT'
  | 'HARD_RETREAT'
  | 'COOLDOWN_LOCK'
  | 'NEUTRALIZED_LOCK';

/**
 * Semantic pressure preference used by doctrine tuning.
 */
export type PreferredPressureBand =
  | 'CALM'
  | 'BUILDING'
  | 'ELEVATED'
  | 'HIGH'
  | 'CRITICAL';

/**
 * Optional doctrinal weight maps used to keep extension logic data-driven without
 * breaking the current BotProfile registry shape.
 */
export type ShieldBiasMap = Readonly<Partial<Record<ShieldLayerId | 'DIRECT', number>>>;
export type CategoryBiasMap = Readonly<Partial<Record<AttackCategory, number>>>;
export type ModeBiasMap = Readonly<Record<ModeCode, number>>;
export type ModeAttackWindowBiasMap = Readonly<Partial<Record<ModeCode, number>>>;

/**
 * Stable, serializable bot doctrine. Existing required fields are preserved so the
 * current registry, injector, and battle engine continue to compile unchanged.
 *
 * All additive fields are optional and should be treated as doctrine hints rather
 * than mandatory runtime dependencies.
 */
export interface BotProfile {
  readonly botId: HaterBotId;
  readonly label: string;
  readonly archetype: string;

  /**
   * Threat gate on a 0..100 tactical scale.
   */
  readonly activationThreshold: number;

  /**
   * Additional room above activationThreshold before the bot escalates.
   */
  readonly watchWindow: number;
  readonly targetWindow: number;

  /**
   * Higher values produce stronger attacks.
   */
  readonly aggression: number;

  readonly preferredCategory: AttackCategory;
  readonly preferredLayer: ShieldLayerId | 'DIRECT';
  readonly preferredTargetEntity: AttackTargetEntity;

  /**
   * Minimum ticks between injections for the same bot.
   */
  readonly cooldownTicks: number;

  /**
   * Weights used to translate normalized pressure and ambient heat into a
   * 0..100 composite threat score.
   */
  readonly pressureWeight: number;
  readonly heatWeight: number;
  readonly rivalryWeight: number;

  /**
   * Mode-specific bias, additive on the 0..100 tactical scale.
   */
  readonly modeWeight: ModeBiasMap;

  readonly notes: readonly string[];

  // ── Additive doctrine controls ───────────────────────────────────────────
  readonly pressureFloor?: number;
  readonly heatFloor?: number;
  readonly rivalryFloor?: number;
  readonly retreatFloor?: number;
  readonly reengageBonus?: number;
  readonly cooldownThreatSuppression?: number;
  readonly volatilityWeight?: number;
  readonly shieldWeight?: number;
  readonly economyWeight?: number;
  readonly cascadeWeight?: number;
  readonly timingWeight?: number;
  readonly momentumWeight?: number;
  readonly intimidationBias?: number;
  readonly closeoutBias?: number;
  readonly trustPunishBias?: number;
  readonly ghostPressureBias?: number;
  readonly budgetSensitivity?: number;
  readonly preferredPressureBand?: PreferredPressureBand;
  readonly weaknessBiasByLayer?: ShieldBiasMap;
  readonly categoryBias?: CategoryBiasMap;
  readonly modeAttackWindowBias?: ModeAttackWindowBiasMap;
}

/**
 * Optional dynamic context passed to the controller. BattleEngine currently passes
 * the small required subset, but richer backend lanes can progressively provide the
 * remaining fields without breaking existing call sites.
 */
export interface BotEvolveInput {
  readonly baseHeat: number;
  readonly pressureScore: number;
  readonly rivalryHeatCarry: number;
  readonly mode: ModeCode;
  readonly tick: number;

  // ── Optional derived deltas ──────────────────────────────────────────────
  readonly previousPressureScore?: number;
  readonly pressureDelta?: number;
  readonly baseHeatDelta?: number;
  readonly rivalryDelta?: number;

  // ── Optional shield context ──────────────────────────────────────────────
  readonly weakestLayerId?: ShieldLayerId;
  readonly weakestLayerRatio?: number;
  readonly weakestLayerCurrent?: number;
  readonly weakestLayerMax?: number;
  readonly shieldOverallIntegrityRatio?: number;
  readonly breachedLayerIds?: readonly ShieldLayerId[];

  // ── Optional economy context ─────────────────────────────────────────────
  readonly cash?: number;
  readonly debt?: number;
  readonly netWorth?: number;
  readonly incomePerTick?: number;
  readonly expensesPerTick?: number;
  readonly freedomTarget?: number;

  // ── Optional battle context ──────────────────────────────────────────────
  readonly battleBudget?: number;
  readonly battleBudgetCap?: number;
  readonly pendingAttackCount?: number;
  readonly pendingPressureTax?: number;
  readonly firstBloodClaimed?: boolean;
  readonly extractionCooldownTicks?: number;
  readonly neutralizedBotIds?: readonly HaterBotId[];

  // ── Optional cascade / threat / mode context ─────────────────────────────
  readonly activeCascadeChains?: number;
  readonly brokenCascadeChains?: number;
  readonly visibleThreatCount?: number;
  readonly anticipationScore?: number;
  readonly communityHeatModifier?: number;
  readonly trustInstability?: number;
  readonly allianceExposure?: number;
  readonly spectatorPressure?: number;
  readonly ghostMarkerCount?: number;
  readonly legendGap?: number;
  readonly counterIntelTier?: number;
  readonly phaseBoundaryWindowsRemaining?: number;
  readonly telemetryWarnings?: readonly string[];
}

/**
 * Fine-grained numerical explanation of the composite threat value.
 */
export interface BotThreatBreakdown {
  readonly baselinePressure: number;
  readonly baselineHeat: number;
  readonly baselineRivalry: number;
  readonly modeBias: number;
  readonly volatilityBonus: number;
  readonly shieldBonus: number;
  readonly economyBonus: number;
  readonly cascadeBonus: number;
  readonly timingBonus: number;
  readonly momentumBonus: number;
  readonly profileBias: number;
  readonly suppression: number;
  readonly preClampTotal: number;
  readonly finalCompositeThreat: number;
}

/**
 * Compact dynamic-context normalization surfaced for debugging and downstream
 * planners.
 */
export interface BotDynamicContext {
  readonly mode: ModeCode;
  readonly tick: number;
  readonly pressureScore: number;
  readonly pressureDelta: number;
  readonly baseHeat: number;
  readonly baseHeatDelta: number;
  readonly rivalryHeatCarry: number;
  readonly rivalryDelta: number;
  readonly weakestLayerId: ShieldLayerId | null;
  readonly weakestLayerRatio: number;
  readonly shieldOverallIntegrityRatio: number;
  readonly cash: number;
  readonly debt: number;
  readonly netWorth: number;
  readonly incomePerTick: number;
  readonly expensesPerTick: number;
  readonly battleBudget: number;
  readonly battleBudgetCap: number;
  readonly pendingAttackCount: number;
  readonly pendingPressureTax: number;
  readonly extractionCooldownTicks: number;
  readonly activeCascadeChains: number;
  readonly brokenCascadeChains: number;
  readonly visibleThreatCount: number;
  readonly anticipationScore: number;
  readonly communityHeatModifier: number;
  readonly trustInstability: number;
  readonly allianceExposure: number;
  readonly spectatorPressure: number;
  readonly ghostMarkerCount: number;
  readonly legendGap: number;
  readonly counterIntelTier: number;
  readonly phaseBoundaryWindowsRemaining: number;
  readonly telemetryWarnings: readonly string[];
}

/**
 * Rich diagnostics emitted by controller.evolve(). Everything here is additive and
 * safe for BattleEngine to ignore, but extremely useful for replay, tuning, chat,
 * proof artifacts, and future ML labels.
 */
export interface BotThreatDiagnostics {
  readonly band: BotThreatBand;
  readonly intent: BotIntentCode;
  readonly momentum: BotMomentumDirection;
  readonly attackWindow: BotAttackWindowState;
  readonly retreatDecision: BotRetreatDecision;
  readonly cooldownRemaining: number;
  readonly context: BotDynamicContext;
  readonly breakdown: BotThreatBreakdown;
  readonly narrativeTags: readonly string[];
  readonly doctrinalNotes: readonly string[];
}

/**
 * Controller result. Existing consumers only require runtime/stateChanged/
 * compositeThreat. Everything else is additive.
 */
export interface BotEvolveResult {
  readonly runtime: BotRuntimeState;
  readonly previousState: BotRuntimeState['state'];
  readonly nextState: BotRuntimeState['state'];
  readonly stateChanged: boolean;
  readonly compositeThreat: number;
  readonly diagnostics: BotThreatDiagnostics;
}

/**
 * AttackInjector input. Current required fields remain intact; additive hints let
 * later injector revisions express more authored attack selection.
 */
export interface AttackBuildInput {
  readonly runId: string;
  readonly tick: number;
  readonly attackIndex: number;
  readonly mode: ModeCode;
  readonly profile: BotProfile;
  readonly pressureScore: number;
  readonly compositeThreat: number;
  readonly firstBloodClaimed: boolean;

  // Optional authored hints
  readonly threatBand?: BotThreatBand;
  readonly intentCode?: BotIntentCode;
  readonly attackWindow?: BotAttackWindowState;
  readonly diagnosticsNotes?: readonly string[];
}

/**
 * Budget-manager input. Existing consumers remain source-compatible.
 */
export interface BudgetResolutionInput {
  readonly current: number;
  readonly cap: number;
  readonly mode: ModeCode;
  readonly injectedAttacks: readonly AttackEvent[];
  readonly firstBloodClaimed: boolean;

  // Optional tuning / replay metadata
  readonly baselineGrant?: number;
  readonly pressureEscalationFactor?: number;
}

export interface BudgetResolution {
  readonly battleBudget: number;
  readonly firstBloodClaimed: boolean;
  readonly notes: readonly string[];

  // Optional additive explanation surface
  readonly grantsApplied?: Readonly<Record<string, number>>;
}

/**
 * Stable enums/constants kept alongside the contracts for deterministic threshold
 * tuning and downstream UI/debug reuse.
 */
export const BOT_THREAT_BANDS: readonly BotThreatBand[] = Object.freeze([
  'DORMANT',
  'LOW',
  'WARM',
  'HOT',
  'CRITICAL',
  'TERMINAL',
]);

export const BOT_INTENT_CODES: readonly BotIntentCode[] = Object.freeze([
  'RESET',
  'PROBE',
  'HARASS',
  'PIN',
  'EXTRACT',
  'LOCK',
  'DRAIN',
  'HEAT_SPIKE',
  'BREACH_SETUP',
  'CLOSE',
  'RETREAT',
]);

export const BOT_MOMENTUM_DIRECTIONS: readonly BotMomentumDirection[] = Object.freeze([
  'COOLING',
  'STABLE',
  'RISING',
  'SPIKING',
]);

export const BOT_ATTACK_WINDOW_STATES: readonly BotAttackWindowState[] = Object.freeze([
  'CLOSED',
  'PRESSURE_ONLY',
  'SOFT_OPEN',
  'OPEN',
  'FORCED',
]);

export const BOT_RETREAT_DECISIONS: readonly BotRetreatDecision[] = Object.freeze([
  'HOLD',
  'SOFT_RETREAT',
  'HARD_RETREAT',
  'COOLDOWN_LOCK',
  'NEUTRALIZED_LOCK',
]);

/**
 * Tactical threat thresholds. These remain purely additive and do not replace each
 * profile's doctrinal activation windows.
 */
export const BOT_THREAT_THRESHOLD_BY_BAND: Readonly<Record<BotThreatBand, number>> =
  Object.freeze({
    DORMANT: 0,
    LOW: 15,
    WARM: 30,
    HOT: 50,
    CRITICAL: 70,
    TERMINAL: 88,
  });

/**
 * Canonical defaults used when new additive doctrine fields are omitted from the
 * current static profile registry.
 */
export const BOT_PROFILE_OPTIONAL_DEFAULTS = Object.freeze({
  pressureFloor: 0,
  heatFloor: 0,
  rivalryFloor: 0,
  retreatFloor: 6,
  reengageBonus: 0,
  cooldownThreatSuppression: 18,
  volatilityWeight: 0.20,
  shieldWeight: 0.22,
  economyWeight: 0.18,
  cascadeWeight: 0.16,
  timingWeight: 0.14,
  momentumWeight: 0.20,
  intimidationBias: 0,
  closeoutBias: 0,
  trustPunishBias: 0,
  ghostPressureBias: 0,
  budgetSensitivity: 0.08,
  preferredPressureBand: 'HIGH' as PreferredPressureBand,
} as const);

/**
 * Zeroed dynamic context used by deterministic normalization.
 */
export const BOT_DYNAMIC_CONTEXT_DEFAULTS: Readonly<BotDynamicContext> = Object.freeze({
  mode: 'solo',
  tick: 0,
  pressureScore: 0,
  pressureDelta: 0,
  baseHeat: 0,
  baseHeatDelta: 0,
  rivalryHeatCarry: 0,
  rivalryDelta: 0,
  weakestLayerId: null,
  weakestLayerRatio: 1,
  shieldOverallIntegrityRatio: 1,
  cash: 0,
  debt: 0,
  netWorth: 0,
  incomePerTick: 0,
  expensesPerTick: 0,
  battleBudget: 0,
  battleBudgetCap: 0,
  pendingAttackCount: 0,
  pendingPressureTax: 0,
  extractionCooldownTicks: 0,
  activeCascadeChains: 0,
  brokenCascadeChains: 0,
  visibleThreatCount: 0,
  anticipationScore: 0,
  communityHeatModifier: 0,
  trustInstability: 0,
  allianceExposure: 0,
  spectatorPressure: 0,
  ghostMarkerCount: 0,
  legendGap: 0,
  counterIntelTier: 0,
  phaseBoundaryWindowsRemaining: 0,
  telemetryWarnings: Object.freeze([]) as readonly string[],
});
