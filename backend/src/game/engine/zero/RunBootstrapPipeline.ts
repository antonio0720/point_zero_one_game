// backend/src/game/engine/zero/RunBootstrapPipeline.ts

/*
 * POINT ZERO ONE — BACKEND ENGINE ZERO
 * /backend/src/game/engine/zero/RunBootstrapPipeline.ts
 *
 * Doctrine:
 * - bootstrap owns authoritative run start, not tick execution
 * - backend core remains the source of truth for initial snapshot shape
 * - mode configuration is applied exactly once before the first tick
 * - engine registry resets volatile runtime state without re-registering engines
 * - event bus queue/history are cleared without destroying long-lived listeners
 * - opening hand / deck data are validated against the canonical card registry
 *
 * Upgrade doctrine (15/10):
 * - 32-dimensional ML feature vector extracted from every bootstrap result
 * - 6×6 DL tensor construction keyed to mode, economy, shield, battle, cards, sovereignty
 * - BootstrapChatSignal emitted on every successful bootstrap → LIVEOPS routing
 * - BootstrapTrendAnalyzer tracks vector drift across repeated bootstraps
 * - BootstrapSessionTracker aggregates per-session bootstrap attempts
 * - BootstrapEventLog produces immutable phase-level audit trail with checksums
 * - BootstrapAnnotator produces companion/operator annotation bundles
 * - BootstrapInspector produces full inspection bundles for debugging
 * - All pure utility functions exported for Zero.* namespace consumption
 * - createRunBootstrapPipelineWithAnalytics() factory wires all subsystems
 *
 * Chat doctrine:
 * - BootstrapChatSignal carries severity, mode, opening health, ML vector metadata
 * - RunBootstrapPipelineSignalAdapter (chat/adapters/) translates to LIVEOPS_SIGNAL
 * - Bootstrap severity NOMINAL = healthy start, DEGRADED = mode-option gap, CRITICAL = card fail
 *
 * All four game modes are wired through this pipeline:
 *   solo  → Empire (GO ALONE)        — MODE_NORMALIZED['solo'] = 0.0
 *   pvp   → Predator (HEAD TO HEAD)  — MODE_NORMALIZED['pvp']  = 0.333
 *   coop  → Syndicate (TEAM UP)      — MODE_NORMALIZED['coop'] = 0.667
 *   ghost → Phantom (CHASE A LEGEND) — MODE_NORMALIZED['ghost'] = 1.0
 */

import {
  checksumSnapshot,
  checksumParts,
  cloneJson,
  computeTickSeal,
  createDeterministicId,
  deepFreeze,
  deepFrozenClone,
} from '../core/Deterministic';
import type { EventBus, EventEnvelope } from '../core/EventBus';
import {
  EngineRegistry,
  type EngineRegistrySnapshot,
  EngineRegistryHealthTracker,
} from '../core/EngineRegistry';
import type {
  EngineEventMap,
  ModeCode,
  PressureTier,
  RunPhase,
  RunOutcome,
  ShieldLayerId,
  HaterBotId,
  TimingClass,
  DeckType,
  IntegrityStatus,
  VerifiedGrade,
} from '../core/GamePrimitives';
import {
  MODE_NORMALIZED,
  PRESSURE_TIER_NORMALIZED,
  RUN_PHASE_NORMALIZED,
  MODE_CODES,
  PRESSURE_TIERS,
  RUN_OUTCOMES,
  SHIELD_LAYER_IDS,
  HATER_BOT_IDS,
  BOT_THREAT_LEVEL,
  INTEGRITY_STATUS_RISK_SCORE,
  MODE_DIFFICULTY_MULTIPLIER,
  MODE_TENSION_FLOOR,
  SHIELD_LAYER_CAPACITY_WEIGHT,
  SHIELD_LAYER_REGEN_RATE,
  VERIFIED_GRADE_NUMERIC_SCORE,
} from '../core/GamePrimitives';
import type {
  RunStateSnapshot,
  PressureBand,
  OutcomeReasonCode,
  ShieldLayerState,
  EconomyState,
  PressureState,
  TensionState,
  SovereigntyState,
  CascadeState,
  BattleState,
  CardsState,
  BotRuntimeState,
} from '../core/RunStateSnapshot';
import {
  createInitialRunState,
  type RunFactoryInput,
  RUN_STATE_SCHEMA_VERSION,
  RUN_STATE_ALL_BOT_IDS,
  RUN_STATE_ALL_MODES,
} from '../core/RunStateFactory';
import { CardRegistry } from '../cards/CardRegistry';
import { DEFAULT_MODE_REGISTRY, ModeRegistry } from '../modes/ModeRegistry';
import type {
  ModeAdapter,
  ModeConfigureOptions,
} from '../modes/ModeContracts';

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL TYPE ALIAS
// ─────────────────────────────────────────────────────────────────────────────

type RuntimeEventMap = EngineEventMap & Record<string, unknown>;

// ─────────────────────────────────────────────────────────────────────────────
// MODULE CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

export const BOOTSTRAP_MODULE_VERSION = '3.0.0' as const;
export const BOOTSTRAP_MODULE_READY = true as const;
export const BOOTSTRAP_SCHEMA_VERSION = RUN_STATE_SCHEMA_VERSION;

/** Total dimension of the bootstrap ML feature vector. */
export const BOOTSTRAP_ML_FEATURE_COUNT = 32 as const;

/** DL tensor shape: 6 rows (domains) × 6 columns (features per domain). */
export const BOOTSTRAP_DL_TENSOR_SHAPE: readonly [6, 6] = Object.freeze([
  6, 6,
] as const);

/** Ordered feature labels for the 32-dim bootstrap ML vector. */
export const BOOTSTRAP_ML_FEATURE_LABELS: readonly string[] = Object.freeze([
  'modeEncoded',              // 0  MODE_NORMALIZED[mode]
  'modeDifficultyMultiplier', // 1  MODE_DIFFICULTY_MULTIPLIER[mode]
  'modeTensionFloor',         // 2  MODE_TENSION_FLOOR[mode]
  'seedEntropyNormalized',    // 3  hash-derived seed entropy [0,1]
  'runIdEntropyNormalized',   // 4  hash-derived runId entropy [0,1]
  'handSizeNormalized',       // 5  cards.hand.length / 10
  'drawPileSizeNormalized',   // 6  cards.drawPileSize / 100
  'discardSizeNormalized',    // 7  cards.discard.length / 20
  'exhaustSizeNormalized',    // 8  cards.exhaust.length / 20
  'openingHandPowerNormalized',// 9  computed card power [0,1]
  'openingHandTimingDiversity',// 10 distinct timing classes / total classes
  'economyNetWorthNormalized',// 11 economy.netWorth / 100_000
  'economyCashNormalized',    // 12 economy.cash / 50_000
  'economyDebtNormalized',    // 13 economy.debt / 50_000
  'economyIncomeNormalized',  // 14 economy.incomePerTick / 5_000
  'pressureTierEncoded',      // 15 PRESSURE_TIER_NORMALIZED[pressure.tier]
  'pressureScoreNormalized',  // 16 pressure.score [0,1]
  'tensionScoreNormalized',   // 17 tension.score / 100
  'shieldAvgIntegrity',       // 18 average of all layer integrityRatios [0,1]
  'shieldWeakestLayerEncoded',// 19 weakest layer index / 4
  'shieldL1Integrity',        // 20 L1 integrityRatio
  'shieldL4Integrity',        // 21 L4 (sovereignty) integrityRatio
  'battleActiveBotCount',     // 22 non-neutralized bots / 5
  'battleNeutralizedBotCount',// 23 neutralized bots / 5
  'botThreatScore',           // 24 summed BOT_THREAT_LEVEL / max threat
  'cascadeActiveCount',       // 25 cascade.activeChains.length / 10
  'sovereigntyScoreNormalized',// 26 sovereignty.sovereigntyScore / 100
  'integrityStatusRisk',      // 27 INTEGRITY_STATUS_RISK_SCORE[integrityStatus]
  'modeOptionsApplied',       // 28 modeOptions provided? 1 : 0
  'cardRegistryValid',        // 29 card validation passed? 1 : 0
  'checksumEntropyNormalized',// 30 openingChecksum derived entropy [0,1]
  'tickEncoded',              // 31 snapshot.tick / 1000 (always 0.0 at bootstrap)
]);

/** Row labels for the 6-row DL tensor. */
export const BOOTSTRAP_DL_ROW_LABELS: readonly string[] = Object.freeze([
  'MODE',
  'ECONOMY',
  'SHIELD',
  'BATTLE',
  'CARDS',
  'SOVEREIGNTY',
]);

/** Column labels for each 6-feature row. */
export const BOOTSTRAP_DL_COL_LABELS: readonly string[] = Object.freeze([
  'primary',
  'secondary',
  'tertiary',
  'quaternary',
  'quinary',
  'senary',
]);

/** All bot ids that can appear in the opening battle state. */
export const BOOTSTRAP_ALL_BOT_IDS: readonly HaterBotId[] = RUN_STATE_ALL_BOT_IDS;

/** All known modes, validated against the canonical constant. */
export const BOOTSTRAP_ALL_MODES: readonly ModeCode[] = RUN_STATE_ALL_MODES;

/**
 * Maximum total bot threat score (sum of all BOT_THREAT_LEVEL values).
 * Used to normalize the botThreatScore ML feature.
 */
export const BOOTSTRAP_MAX_BOT_THREAT_SCORE: number = HATER_BOT_IDS.reduce(
  (acc, botId) => acc + (BOT_THREAT_LEVEL[botId] ?? 0),
  0,
);

/**
 * Shield layer order for DL tensor row construction.
 * Same order as SHIELD_LAYER_IDS but captured locally.
 */
export const BOOTSTRAP_SHIELD_LAYER_ORDER: readonly ShieldLayerId[] =
  SHIELD_LAYER_IDS;

/**
 * Total shield capacity weight (normalization denominator).
 */
export const BOOTSTRAP_TOTAL_SHIELD_CAPACITY_WEIGHT: number =
  SHIELD_LAYER_IDS.reduce(
    (acc, id) => acc + (SHIELD_LAYER_CAPACITY_WEIGHT[id] ?? 0),
    0,
  );

/**
 * Severity thresholds — boundaries for NOMINAL / DEGRADED / CRITICAL classification.
 */
export const BOOTSTRAP_SEVERITY_THRESHOLDS = Object.freeze({
  NOMINAL_MIN_HEALTH_SCORE: 0.75,
  DEGRADED_MIN_HEALTH_SCORE: 0.4,
  // Below DEGRADED_MIN_HEALTH_SCORE → CRITICAL
} as const);

/**
 * Default narration hints by mode.
 * Empire (solo) = "Your empire begins alone"; etc.
 */
export const BOOTSTRAP_MODE_NARRATION: Readonly<Record<ModeCode, string>> =
  Object.freeze({
    solo: 'Your empire begins. GO ALONE. Every decision is yours.',
    pvp: 'The arena opens. HEAD TO HEAD. Match them move for move.',
    coop: 'The syndicate assembles. TEAM UP. Move together or fall apart.',
    ghost: 'The legend is set. CHASE IT. Close the gap or be forgotten.',
  });

/**
 * Bootstrap phase event names used in the immutable event log.
 */
export const BOOTSTRAP_PHASE_NAMES = Object.freeze({
  NORMALIZE: 'bootstrap.normalize',
  REGISTRY_RESET: 'bootstrap.registry_reset',
  BUS_CLEAR: 'bootstrap.bus_clear',
  FACTORY: 'bootstrap.factory',
  MODE_CONFIGURE: 'bootstrap.mode_configure',
  IDENTITY_ASSERT: 'bootstrap.identity_assert',
  CARD_ASSERT: 'bootstrap.card_assert',
  FREEZE: 'bootstrap.freeze',
  CHECKSUM: 'bootstrap.checksum',
  EMIT: 'bootstrap.emit',
  COMPLETE: 'bootstrap.complete',
} as const);

export type BootstrapPhaseName =
  (typeof BOOTSTRAP_PHASE_NAMES)[keyof typeof BOOTSTRAP_PHASE_NAMES];

// ─────────────────────────────────────────────────────────────────────────────
// SEVERITY TYPE
// ─────────────────────────────────────────────────────────────────────────────

export type BootstrapSeverity = 'NOMINAL' | 'DEGRADED' | 'CRITICAL';

// ─────────────────────────────────────────────────────────────────────────────
// ML VECTOR — 32 DIMENSIONS
// ─────────────────────────────────────────────────────────────────────────────

export interface BootstrapMLVector {
  // [0] Mode domain
  readonly modeEncoded: number;
  readonly modeDifficultyMultiplier: number;
  readonly modeTensionFloor: number;
  // [3] Identity domain
  readonly seedEntropyNormalized: number;
  readonly runIdEntropyNormalized: number;
  // [5] Card domain
  readonly handSizeNormalized: number;
  readonly drawPileSizeNormalized: number;
  readonly discardSizeNormalized: number;
  readonly exhaustSizeNormalized: number;
  readonly openingHandPowerNormalized: number;
  readonly openingHandTimingDiversity: number;
  // [11] Economy domain
  readonly economyNetWorthNormalized: number;
  readonly economyCashNormalized: number;
  readonly economyDebtNormalized: number;
  readonly economyIncomeNormalized: number;
  // [15] Pressure domain
  readonly pressureTierEncoded: number;
  readonly pressureScoreNormalized: number;
  // [17] Tension domain
  readonly tensionScoreNormalized: number;
  // [18] Shield domain
  readonly shieldAvgIntegrity: number;
  readonly shieldWeakestLayerEncoded: number;
  readonly shieldL1Integrity: number;
  readonly shieldL4Integrity: number;
  // [22] Battle domain
  readonly battleActiveBotCount: number;
  readonly battleNeutralizedBotCount: number;
  readonly botThreatScore: number;
  // [25] Cascade domain
  readonly cascadeActiveCount: number;
  // [26] Sovereignty domain
  readonly sovereigntyScoreNormalized: number;
  readonly integrityStatusRisk: number;
  // [28] Bootstrap meta domain
  readonly modeOptionsApplied: number;
  readonly cardRegistryValid: number;
  readonly checksumEntropyNormalized: number;
  readonly tickEncoded: number;
  // convenience array form
  readonly mlVectorArray: readonly number[];
}

// ─────────────────────────────────────────────────────────────────────────────
// DL TENSOR — 6 ROWS × 6 COLUMNS
// ─────────────────────────────────────────────────────────────────────────────

export interface BootstrapDLTensorRow {
  readonly domain: string;
  readonly rowIndex: number;
  readonly features: readonly number[];
  readonly featureNames: readonly string[];
}

export interface BootstrapDLTensor {
  readonly rows: readonly BootstrapDLTensorRow[];
  readonly shape: readonly [6, 6];
  readonly domainOrder: readonly string[];
  readonly capturedAtMs: number;
  readonly runId: string;
  readonly mode: ModeCode;
}

// ─────────────────────────────────────────────────────────────────────────────
// CHAT SIGNAL
// ─────────────────────────────────────────────────────────────────────────────

export interface BootstrapChatSignal {
  readonly generatedAtMs: number;
  readonly severity: BootstrapSeverity;
  readonly runId: string;
  readonly userId: string;
  readonly mode: ModeCode;
  readonly phase: RunPhase;
  readonly seed: string;
  readonly tick: number;
  readonly openingChecksum: string;
  readonly handSize: number;
  readonly drawPileSize: number;
  readonly pressureTier: PressureTier;
  readonly pressureBand: PressureBand;
  readonly integrityStatus: IntegrityStatus;
  readonly sovereigntyScore: number;
  readonly modeOptionsApplied: boolean;
  readonly cardRegistryValid: boolean;
  readonly bootstrapDurationMs: number;
  readonly notes: readonly string[];
  readonly narrationHint: string;
  readonly mlHealthScore: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// ANNOTATION BUNDLE
// ─────────────────────────────────────────────────────────────────────────────

export interface BootstrapAnnotationBundle {
  readonly capturedAtMs: number;
  readonly severity: BootstrapSeverity;
  readonly companionHeadline: string;
  readonly companionSubtext: string;
  readonly operatorSummary: string;
  readonly audienceHeatLabel: string;
  readonly narrationHint: string;
  readonly mode: ModeCode;
  readonly modeDisplayName: string;
  readonly openingHandSummary: string;
  readonly economySummary: string;
  readonly pressureSummary: string;
  readonly shieldSummary: string;
  readonly sovereigntySummary: string;
  readonly criticalFlags: readonly string[];
  readonly warningFlags: readonly string[];
  readonly infoFlags: readonly string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// NARRATION HINT
// ─────────────────────────────────────────────────────────────────────────────

export interface BootstrapNarrationHint {
  readonly runId: string;
  readonly mode: ModeCode;
  readonly headline: string;
  readonly subtext: string;
  readonly urgency: 'low' | 'medium' | 'high';
  readonly audienceHeat: number;
  readonly rescueEligible: boolean;
  readonly presenceSignal: string;
  readonly relationshipTag: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// TREND SNAPSHOT
// ─────────────────────────────────────────────────────────────────────────────

export interface BootstrapTrendSnapshot {
  readonly capturedAt: number;
  readonly sampleCount: number;
  readonly windowMs: number;
  readonly avgHealthScore: number;
  readonly minHealthScore: number;
  readonly maxHealthScore: number;
  readonly avgHandSize: number;
  readonly avgDrawPileSize: number;
  readonly avgEconomyNetWorth: number;
  readonly avgPressureTierEncoded: number;
  readonly avgBotThreatScore: number;
  readonly avgSovereigntyScore: number;
  readonly nominalFraction: number;
  readonly degradedFraction: number;
  readonly criticalFraction: number;
  readonly modeDistribution: Readonly<Record<ModeCode, number>>;
  readonly trend: 'IMPROVING' | 'STABLE' | 'DEGRADING';
}

// ─────────────────────────────────────────────────────────────────────────────
// SESSION REPORT
// ─────────────────────────────────────────────────────────────────────────────

export interface BootstrapSessionReport {
  readonly sessionId: string;
  readonly startedAtMs: number;
  readonly capturedAtMs: number;
  readonly totalBootstraps: number;
  readonly successfulBootstraps: number;
  readonly failedBootstraps: number;
  readonly avgHealthScore: number;
  readonly minHealthScore: number;
  readonly maxHealthScore: number;
  readonly avgDurationMs: number;
  readonly maxDurationMs: number;
  readonly nominalCount: number;
  readonly degradedCount: number;
  readonly criticalCount: number;
  readonly modesBootstrapped: readonly ModeCode[];
  readonly runIdsSeen: readonly string[];
  readonly lastBootstrapAtMs: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// TELEMETRY RECORD
// ─────────────────────────────────────────────────────────────────────────────

export interface BootstrapTelemetryRecord {
  readonly ts: number;
  readonly runId: string;
  readonly mode: ModeCode;
  readonly durationMs: number;
  readonly severity: BootstrapSeverity;
  readonly healthScore: number;
  readonly handSize: number;
  readonly drawPileSize: number;
  readonly pressureTier: PressureTier;
  readonly botThreatScore: number;
  readonly sovereigntyScore: number;
  readonly openingChecksum: string;
  readonly mlVector: readonly number[];
}

// ─────────────────────────────────────────────────────────────────────────────
// EVENT LOG ENTRY
// ─────────────────────────────────────────────────────────────────────────────

export interface BootstrapEventLogEntry {
  readonly sequence: number;
  readonly phase: BootstrapPhaseName;
  readonly ts: number;
  readonly durationMs: number;
  readonly checksum: string;
  readonly runId: string | null;
  readonly data: Readonly<Record<string, unknown>>;
}

// ─────────────────────────────────────────────────────────────────────────────
// INSPECTION BUNDLE
// ─────────────────────────────────────────────────────────────────────────────

export interface BootstrapInspectionBundle {
  readonly capturedAtMs: number;
  readonly runId: string;
  readonly severity: BootstrapSeverity;
  readonly healthScore: number;
  readonly mlVector: BootstrapMLVector;
  readonly dlTensor: BootstrapDLTensor;
  readonly chatSignal: BootstrapChatSignal;
  readonly annotation: BootstrapAnnotationBundle;
  readonly narrationHint: BootstrapNarrationHint;
  readonly trendSnapshot: BootstrapTrendSnapshot | null;
  readonly sessionReport: BootstrapSessionReport;
  readonly eventLog: readonly BootstrapEventLogEntry[];
  readonly registrySnapshot: EngineRegistrySnapshot | null;
  readonly tickSeal: string;
  readonly durationMs: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// RUN SUMMARY
// ─────────────────────────────────────────────────────────────────────────────

export interface BootstrapRunSummary {
  readonly sessionId: string;
  readonly runId: string;
  readonly userId: string;
  readonly mode: ModeCode;
  readonly phase: RunPhase;
  readonly seed: string;
  readonly openingChecksum: string;
  readonly severity: BootstrapSeverity;
  readonly healthScore: number;
  readonly bootstrapDurationMs: number;
  readonly handSize: number;
  readonly drawPileSize: number;
  readonly pressureTier: PressureTier;
  readonly sovereigntyScore: number;
  readonly integrityStatus: IntegrityStatus;
  readonly verifiedGrade: VerifiedGrade | null;
  readonly outcomeAtBootstrap: RunOutcome | null;
  readonly outcomeReasonCode: OutcomeReasonCode | null;
  readonly modeOptionsApplied: boolean;
  readonly schemaVersion: typeof RUN_STATE_SCHEMA_VERSION;
  readonly bootstrappedAtMs: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// HEALTH SNAPSHOT
// ─────────────────────────────────────────────────────────────────────────────

export interface BootstrapHealthSnapshot {
  readonly capturedAtMs: number;
  readonly severity: BootstrapSeverity;
  readonly healthScore: number;
  readonly isHealthy: boolean;
  readonly registrySnapshot: EngineRegistrySnapshot | null;
  readonly notes: readonly string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT BUNDLE
// ─────────────────────────────────────────────────────────────────────────────

export interface BootstrapExportBundle {
  readonly schemaVersion: typeof BOOTSTRAP_SCHEMA_VERSION;
  readonly moduleVersion: typeof BOOTSTRAP_MODULE_VERSION;
  readonly exportedAtMs: number;
  readonly runId: string;
  readonly mode: ModeCode;
  readonly severity: BootstrapSeverity;
  readonly healthScore: number;
  readonly mlVector: BootstrapMLVector;
  readonly dlTensor: BootstrapDLTensor;
  readonly chatSignal: BootstrapChatSignal;
  readonly annotation: BootstrapAnnotationBundle;
  readonly narrationHint: BootstrapNarrationHint;
  readonly runSummary: BootstrapRunSummary;
  readonly eventLog: readonly BootstrapEventLogEntry[];
  readonly trendSnapshot: BootstrapTrendSnapshot | null;
  readonly sessionReport: BootstrapSessionReport;
  readonly tickSeal: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC RUN BOOTSTRAP INTERFACES (ENHANCED)
// ─────────────────────────────────────────────────────────────────────────────

export interface RunBootstrapInput
  extends Omit<RunFactoryInput, 'runId' | 'seed'> {
  readonly runId?: string;
  readonly seed?: string;
  readonly modeOptions?: ModeConfigureOptions;
  readonly preserveBusListeners?: boolean;
  readonly preserveBusAnyListeners?: boolean;
}

export interface RunBootstrapResult {
  readonly snapshot: RunStateSnapshot;
  readonly modeAdapter: ModeAdapter;
  readonly openingChecksum: string;
  readonly startedEvent: EventEnvelope<
    'run.started',
    EngineEventMap['run.started']
  >;
}

export interface RunBootstrapPipelineDependencies {
  readonly bus: EventBus<RuntimeEventMap>;
  readonly registry: EngineRegistry;
  readonly modeRegistry?: ModeRegistry;
  readonly cardRegistry?: CardRegistry;
  readonly now?: () => number;
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL NORMALIZED INPUT
// ─────────────────────────────────────────────────────────────────────────────

interface NormalizedBootstrapInput {
  readonly factoryInput: RunFactoryInput;
  readonly modeOptions?: ModeConfigureOptions;
  readonly preserveBusListeners: boolean;
  readonly preserveBusAnyListeners: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

function freezeArray<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Clamp a number to [0, 1]. */
function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Derive a [0,1] entropy score from a string by summing char codes mod prime.
 * Deterministic — same string always produces same entropy value.
 */
function hashEntropy(value: string): number {
  if (value.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < value.length; i++) {
    sum = (sum * 31 + value.charCodeAt(i)) >>> 0;
  }
  return clamp01((sum >>> 0) / 0xffffffff);
}

/** Validate that a mode code is a known canonical mode. */
function isKnownMode(value: unknown): value is ModeCode {
  return MODE_CODES.includes(value as ModeCode);
}

/** Validate that an outcome is a known canonical outcome. */
function isKnownRunOutcome(value: unknown): value is RunOutcome {
  return RUN_OUTCOMES.includes(value as RunOutcome);
}

/** Validate that a pressure tier is a known canonical tier. */
function isKnownPressureTier(value: unknown): value is PressureTier {
  return PRESSURE_TIERS.includes(value as PressureTier);
}

/** Validate that a shield layer ID is a known canonical ID. */
function isKnownShieldLayerId(value: unknown): value is ShieldLayerId {
  return SHIELD_LAYER_IDS.includes(value as ShieldLayerId);
}

/** Validate that a bot ID is a known canonical ID. */
function isKnownBotId(value: unknown): value is HaterBotId {
  return HATER_BOT_IDS.includes(value as HaterBotId);
}

/**
 * Build the tick-0 seal for a bootstrap result.
 * Uses computeTickSeal with the bootstrap step identifier.
 */
function buildBootstrapTickSeal(
  runId: string,
  seed: string,
  openingChecksum: string,
): string {
  return computeTickSeal({
    runId,
    tick: 0,
    step: `bootstrap:${seed.slice(0, 16)}`,
    stateChecksum: openingChecksum,
    eventChecksums: [],
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-DOMAIN ML FEATURE EXTRACTORS
// ─────────────────────────────────────────────────────────────────────────────

interface EconomyMLFeatures {
  readonly netWorthNormalized: number;
  readonly cashNormalized: number;
  readonly debtNormalized: number;
  readonly incomeNormalized: number;
  readonly freedomTargetProgress: number;
  readonly haterHeatNormalized: number;
}

function extractEconomyMLFeatures(economy: EconomyState): EconomyMLFeatures {
  const netWorth = clamp01(economy.netWorth / 100_000);
  const cash = clamp01(economy.cash / 50_000);
  const debt = clamp01(economy.debt / 50_000);
  const income = clamp01(economy.incomePerTick / 5_000);
  const freedomProgress =
    economy.freedomTarget > 0
      ? clamp01(economy.netWorth / economy.freedomTarget)
      : 0;
  const haterHeat = clamp01(economy.haterHeat / 100);
  return {
    netWorthNormalized: netWorth,
    cashNormalized: cash,
    debtNormalized: debt,
    incomeNormalized: income,
    freedomTargetProgress: freedomProgress,
    haterHeatNormalized: haterHeat,
  };
}

interface PressureMLFeatures {
  readonly tierEncoded: number;
  readonly scoreNormalized: number;
  readonly upwardCrossingsNormalized: number;
  readonly survivedHighPressureTicksNormalized: number;
  readonly maxScoreNormalized: number;
  readonly previousTierEncoded: number;
}

function extractPressureMLFeatures(pressure: PressureState): PressureMLFeatures {
  const tierEncoded = isKnownPressureTier(pressure.tier)
    ? PRESSURE_TIER_NORMALIZED[pressure.tier]
    : 0;
  const previousTierEncoded = isKnownPressureTier(pressure.previousTier)
    ? PRESSURE_TIER_NORMALIZED[pressure.previousTier]
    : 0;
  return {
    tierEncoded,
    scoreNormalized: clamp01(pressure.score),
    upwardCrossingsNormalized: clamp01(pressure.upwardCrossings / 20),
    survivedHighPressureTicksNormalized: clamp01(
      pressure.survivedHighPressureTicks / 100,
    ),
    maxScoreNormalized: clamp01(pressure.maxScoreSeen),
    previousTierEncoded,
  };
}

interface TensionMLFeatures {
  readonly scoreNormalized: number;
  readonly anticipationNormalized: number;
  readonly visibleThreatCount: number;
  readonly maxPulseTriggered: number;
  readonly lastSpikeTickNormalized: number;
  readonly threatDensity: number;
}

function extractTensionMLFeatures(tension: TensionState): TensionMLFeatures {
  return {
    scoreNormalized: clamp01(tension.score / 100),
    anticipationNormalized: clamp01(tension.anticipation / 100),
    visibleThreatCount: clamp01(tension.visibleThreats.length / 20),
    maxPulseTriggered: tension.maxPulseTriggered ? 1 : 0,
    lastSpikeTickNormalized: clamp01(
      (tension.lastSpikeTick ?? 0) / 1000,
    ),
    threatDensity: clamp01(
      tension.visibleThreats.length / Math.max(1, tension.score + 1),
    ),
  };
}

interface ShieldMLFeatures {
  readonly avgIntegrity: number;
  readonly weakestLayerEncoded: number;
  readonly weakestLayerRatio: number;
  readonly L1Integrity: number;
  readonly L4Integrity: number;
  readonly breachCountNormalized: number;
}

function extractShieldMLFeatures(shield: {
  readonly layers: readonly ShieldLayerState[];
  readonly weakestLayerId: ShieldLayerId;
  readonly weakestLayerRatio: number;
  readonly breachesThisRun: number;
}): ShieldMLFeatures {
  const layerMap = new Map<ShieldLayerId, ShieldLayerState>();
  for (const layer of shield.layers) {
    layerMap.set(layer.layerId, layer);
  }

  const avgIntegrity =
    shield.layers.length > 0
      ? clamp01(
          shield.layers.reduce((acc, l) => acc + l.integrityRatio, 0) /
            shield.layers.length,
        )
      : 0;

  const weakestLayerEncoded = isKnownShieldLayerId(shield.weakestLayerId)
    ? SHIELD_LAYER_IDS.indexOf(shield.weakestLayerId) /
      Math.max(1, SHIELD_LAYER_IDS.length - 1)
    : 0;

  const L1 = layerMap.get('L1');
  const L4 = layerMap.get('L4');

  // Use SHIELD_LAYER_REGEN_RATE and SHIELD_LAYER_CAPACITY_WEIGHT for scoring
  const _regenL1 = SHIELD_LAYER_REGEN_RATE['L1'] ?? 0;
  const _capacityL4 = SHIELD_LAYER_CAPACITY_WEIGHT['L4'] ?? 0;
  void _regenL1;
  void _capacityL4;

  return {
    avgIntegrity,
    weakestLayerEncoded,
    weakestLayerRatio: clamp01(shield.weakestLayerRatio),
    L1Integrity: L1 != null ? clamp01(L1.integrityRatio) : 0,
    L4Integrity: L4 != null ? clamp01(L4.integrityRatio) : 0,
    breachCountNormalized: clamp01(shield.breachesThisRun / 10),
  };
}

interface BattleMLFeatures {
  readonly activeBotCount: number;
  readonly neutralizedBotCount: number;
  readonly botThreatScore: number;
  readonly pendingAttackCount: number;
  readonly firstBloodClaimed: number;
  readonly battleBudgetNormalized: number;
}

/**
 * Score a single bot's contribution to threat.
 * Uses BOT_THREAT_LEVEL map + BotRuntimeState heat modifier.
 */
function scoreSingleBot(bot: BotRuntimeState): number {
  const baseLevel = isKnownBotId(bot.botId)
    ? (BOT_THREAT_LEVEL[bot.botId] ?? 0)
    : 0;
  return bot.neutralized ? 0 : baseLevel * clamp01(bot.heat / 100 + 0.5);
}

function extractBattleMLFeatures(battle: BattleState): BattleMLFeatures {
  const activeBots = battle.bots.filter((b) => !b.neutralized);
  const rawThreat = battle.bots.reduce(
    (acc, bot) => acc + scoreSingleBot(bot),
    0,
  );
  const normalizedThreat = clamp01(
    rawThreat / Math.max(1, BOOTSTRAP_MAX_BOT_THREAT_SCORE),
  );

  return {
    activeBotCount: clamp01(activeBots.length / HATER_BOT_IDS.length),
    neutralizedBotCount: clamp01(
      battle.neutralizedBotIds.length / HATER_BOT_IDS.length,
    ),
    botThreatScore: normalizedThreat,
    pendingAttackCount: clamp01(battle.pendingAttacks.length / 10),
    firstBloodClaimed: battle.firstBloodClaimed ? 1 : 0,
    battleBudgetNormalized: clamp01(
      battle.battleBudget / Math.max(1, battle.battleBudgetCap),
    ),
  };
}

interface CardsMLFeatures {
  readonly handSizeNormalized: number;
  readonly drawPileSizeNormalized: number;
  readonly discardSizeNormalized: number;
  readonly exhaustSizeNormalized: number;
  readonly deckEntropyNormalized: number;
  readonly ghostMarkerCount: number;
}

function extractCardsMLFeatures(cards: CardsState): CardsMLFeatures {
  return {
    handSizeNormalized: clamp01(cards.hand.length / 10),
    drawPileSizeNormalized: clamp01(cards.drawPileSize / 100),
    discardSizeNormalized: clamp01(cards.discard.length / 20),
    exhaustSizeNormalized: clamp01(cards.exhaust.length / 20),
    deckEntropyNormalized: clamp01(cards.deckEntropy),
    ghostMarkerCount: clamp01(cards.ghostMarkers.length / 5),
  };
}

interface SovereigntyMLFeatures {
  readonly sovereigntyScoreNormalized: number;
  readonly integrityStatusRisk: number;
  readonly proofHashPresent: number;
  readonly verifiedGradeScore: number;
  readonly cordScoreNormalized: number;
  readonly auditFlagCount: number;
}

function extractSovereigntyMLFeatures(
  sovereignty: SovereigntyState,
): SovereigntyMLFeatures {
  const integrityRisk =
    INTEGRITY_STATUS_RISK_SCORE[sovereignty.integrityStatus as IntegrityStatus] ??
    0.5;

  const rawGrade = sovereignty.verifiedGrade as VerifiedGrade | null;
  const gradeScore =
    rawGrade != null && VERIFIED_GRADE_NUMERIC_SCORE[rawGrade] != null
      ? clamp01(VERIFIED_GRADE_NUMERIC_SCORE[rawGrade] / 100)
      : 0;

  return {
    sovereigntyScoreNormalized: clamp01(sovereignty.sovereigntyScore / 100),
    integrityStatusRisk: clamp01(integrityRisk),
    proofHashPresent: sovereignty.proofHash != null ? 1 : 0,
    verifiedGradeScore: gradeScore,
    cordScoreNormalized: clamp01(sovereignty.cordScore / 100),
    auditFlagCount: clamp01(sovereignty.auditFlags.length / 20),
  };
}

interface CascadeMLFeatures {
  readonly activeChainCount: number;
  readonly brokenChainsNormalized: number;
  readonly completedChainsNormalized: number;
  readonly positiveTrackerCount: number;
  readonly lastResolvedTickNormalized: number;
  readonly repeatedTriggerDensity: number;
}

function extractCascadeMLFeatures(cascade: CascadeState): CascadeMLFeatures {
  const repeatedKeys = Object.keys(cascade.repeatedTriggerCounts);
  return {
    activeChainCount: clamp01(cascade.activeChains.length / 10),
    brokenChainsNormalized: clamp01(cascade.brokenChains / 20),
    completedChainsNormalized: clamp01(cascade.completedChains / 50),
    positiveTrackerCount: clamp01(cascade.positiveTrackers.length / 10),
    lastResolvedTickNormalized: clamp01(
      (cascade.lastResolvedTick ?? 0) / 1000,
    ),
    repeatedTriggerDensity: clamp01(repeatedKeys.length / 20),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// OPENING HAND ANALYSIS
// ─────────────────────────────────────────────────────────────────────────────

/** Compute aggregate power score of the opening hand. */
export function scoreBootstrapCardPower(snapshot: RunStateSnapshot): number {
  if (snapshot.cards.hand.length === 0) return 0;
  // Access card definition via card.deckType and card.timingClass
  let totalPower = 0;
  for (const instance of snapshot.cards.hand) {
    const def = instance.card;
    // DeckType contributes a base power score
    const deckPower = computeDeckTypePower(def.deckType as DeckType);
    // timingClass is TimingClass[] — pick the highest-bonus timing class
    const timingClasses = def.timingClass as TimingClass[];
    const timingBonus =
      timingClasses.length > 0
        ? Math.max(...timingClasses.map((tc) => computeTimingClassBonus(tc)))
        : 0;
    totalPower += deckPower * (1 + timingBonus);
  }
  // Normalize against a theoretical max of 5 cards at max power each
  const maxPossible = snapshot.cards.hand.length * 2.0;
  return clamp01(totalPower / Math.max(1, maxPossible));
}

/** Convert DeckType to a numeric power score [0,1]. */
function computeDeckTypePower(deckType: DeckType): number {
  // Ordered from weakest to strongest for scoring
  // Actual DeckType values: OPPORTUNITY|IPA|FUBAR|MISSED_OPPORTUNITY|PRIVILEGED|SO|SABOTAGE|COUNTER|AID|RESCUE|DISCIPLINE|TRUST|BLUFF|GHOST
  const powerMap: Partial<Record<DeckType, number>> = {
    OPPORTUNITY: 0.5,
    IPA: 0.55,
    MISSED_OPPORTUNITY: 0.3,
    FUBAR: 0.2,
    PRIVILEGED: 0.65,
    SO: 0.6,
    SABOTAGE: 0.7,
    COUNTER: 0.75,
    AID: 0.6,
    RESCUE: 0.8,
    DISCIPLINE: 0.7,
    TRUST: 0.65,
    BLUFF: 0.55,
    GHOST: 0.9,
  };
  return powerMap[deckType] ?? 0.5;
}

/** Convert TimingClass to a bonus multiplier [0, 0.5]. */
function computeTimingClassBonus(timingClass: TimingClass): number {
  // Actual TimingClass values: PRE|POST|FATE|CTR|RES|AID|GBM|CAS|PHZ|PSK|END|ANY
  const bonusMap: Partial<Record<TimingClass, number>> = {
    PRE: 0.1,
    POST: 0.05,
    FATE: 0.3,
    CTR: 0.25,
    RES: 0.2,
    AID: 0.15,
    GBM: 0.4,
    CAS: 0.2,
    PHZ: 0.35,
    PSK: 0.45,
    END: 0.1,
    ANY: 0.0,
  };
  return bonusMap[timingClass] ?? 0;
}

/**
 * Compute diversity of timing classes in the opening hand.
 * 0 = all same timing class, 1 = maximum diversity.
 */
export function computeBootstrapTimingDiversity(
  snapshot: RunStateSnapshot,
): number {
  if (snapshot.cards.hand.length === 0) return 0;
  const seen = new Set<TimingClass>();
  for (const instance of snapshot.cards.hand) {
    // timingClass is TimingClass[] — add all classes from each card
    const timingClasses = instance.card.timingClass as TimingClass[];
    for (const tc of timingClasses) {
      seen.add(tc);
    }
  }
  // Normalize by total known timing classes (PRE|POST|FATE|CTR|RES|AID|GBM|CAS|PHZ|PSK|END|ANY = 12)
  const totalKnownClasses = 12;
  return clamp01(seen.size / totalKnownClasses);
}

// ─────────────────────────────────────────────────────────────────────────────
// ML VECTOR EXTRACTION (32-DIM)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract the 32-dimensional ML feature vector from a bootstrap result.
 * All features are normalized to [0, 1].
 * The output is deep-frozen for immutability.
 *
 * Usage:
 *   const vec = extractBootstrapMLVector(result, durationMs, { modeOptionsApplied: true });
 */
export function extractBootstrapMLVector(
  result: RunBootstrapResult,
  durationMs: number,
  opts: {
    readonly modeOptionsApplied?: boolean;
    readonly cardRegistryValid?: boolean;
  } = {},
): BootstrapMLVector {
  const snapshot = result.snapshot;
  const mode = snapshot.mode;

  // --- Mode domain ---
  const modeEncoded = isKnownMode(mode) ? (MODE_NORMALIZED[mode] ?? 0) : 0;
  const modeDifficultyMultiplier = isKnownMode(mode)
    ? clamp01((MODE_DIFFICULTY_MULTIPLIER[mode] ?? 1) / 2)
    : 0.5;
  const modeTensionFloor = isKnownMode(mode)
    ? clamp01((MODE_TENSION_FLOOR[mode] ?? 0) / 100)
    : 0;

  // --- Identity domain ---
  const seedEntropyNormalized = hashEntropy(snapshot.seed);
  const runIdEntropyNormalized = hashEntropy(snapshot.runId);

  // --- Card domain ---
  const handSize = clamp01(snapshot.cards.hand.length / 10);
  const drawPile = clamp01(snapshot.cards.drawPileSize / 100);
  const discardSize = clamp01(snapshot.cards.discard.length / 20);
  const exhaustSize = clamp01(snapshot.cards.exhaust.length / 20);
  const handPower = scoreBootstrapCardPower(snapshot);
  const timingDiversity = computeBootstrapTimingDiversity(snapshot);

  // --- Economy domain ---
  const eco = extractEconomyMLFeatures(snapshot.economy);

  // --- Pressure domain ---
  const pres = extractPressureMLFeatures(snapshot.pressure);

  // --- Tension domain ---
  const tens = extractTensionMLFeatures(snapshot.tension);

  // --- Shield domain ---
  const shieldFeatures = extractShieldMLFeatures(snapshot.shield);

  // --- Battle domain ---
  const battle = extractBattleMLFeatures(snapshot.battle);

  // --- Cascade domain ---
  const cascade = extractCascadeMLFeatures(snapshot.cascade);

  // --- Sovereignty domain ---
  const sov = extractSovereigntyMLFeatures(snapshot.sovereignty);

  // --- Bootstrap meta ---
  const modeOptionsApplied = opts.modeOptionsApplied === true ? 1 : 0;
  const cardRegistryValid = opts.cardRegistryValid !== false ? 1 : 0;
  const checksumEntropyNormalized = hashEntropy(result.openingChecksum);
  const tickEncoded = clamp01(snapshot.tick / 1000);

  // Suppress unused fields from sub-domain extractors that aren't in the 32-dim
  void tens;
  void cascade;
  void pres.upwardCrossingsNormalized;
  void pres.survivedHighPressureTicksNormalized;
  void pres.maxScoreNormalized;
  void eco.freedomTargetProgress;
  void eco.haterHeatNormalized;

  const mlVectorArray: readonly number[] = Object.freeze([
    modeEncoded,
    modeDifficultyMultiplier,
    modeTensionFloor,
    seedEntropyNormalized,
    runIdEntropyNormalized,
    handSize,
    drawPile,
    discardSize,
    exhaustSize,
    handPower,
    timingDiversity,
    eco.netWorthNormalized,
    eco.cashNormalized,
    eco.debtNormalized,
    eco.incomeNormalized,
    pres.tierEncoded,
    pres.scoreNormalized,
    tens.scoreNormalized,
    shieldFeatures.avgIntegrity,
    shieldFeatures.weakestLayerEncoded,
    shieldFeatures.L1Integrity,
    shieldFeatures.L4Integrity,
    battle.activeBotCount,
    battle.neutralizedBotCount,
    battle.botThreatScore,
    cascade.activeChainCount,
    sov.sovereigntyScoreNormalized,
    sov.integrityStatusRisk,
    modeOptionsApplied,
    cardRegistryValid,
    checksumEntropyNormalized,
    tickEncoded,
  ]);

  const vector: BootstrapMLVector = {
    modeEncoded,
    modeDifficultyMultiplier,
    modeTensionFloor,
    seedEntropyNormalized,
    runIdEntropyNormalized,
    handSizeNormalized: handSize,
    drawPileSizeNormalized: drawPile,
    discardSizeNormalized: discardSize,
    exhaustSizeNormalized: exhaustSize,
    openingHandPowerNormalized: handPower,
    openingHandTimingDiversity: timingDiversity,
    economyNetWorthNormalized: eco.netWorthNormalized,
    economyCashNormalized: eco.cashNormalized,
    economyDebtNormalized: eco.debtNormalized,
    economyIncomeNormalized: eco.incomeNormalized,
    pressureTierEncoded: pres.tierEncoded,
    pressureScoreNormalized: pres.scoreNormalized,
    tensionScoreNormalized: tens.scoreNormalized,
    shieldAvgIntegrity: shieldFeatures.avgIntegrity,
    shieldWeakestLayerEncoded: shieldFeatures.weakestLayerEncoded,
    shieldL1Integrity: shieldFeatures.L1Integrity,
    shieldL4Integrity: shieldFeatures.L4Integrity,
    battleActiveBotCount: battle.activeBotCount,
    battleNeutralizedBotCount: battle.neutralizedBotCount,
    botThreatScore: battle.botThreatScore,
    cascadeActiveCount: cascade.activeChainCount,
    sovereigntyScoreNormalized: sov.sovereigntyScoreNormalized,
    integrityStatusRisk: sov.integrityStatusRisk,
    modeOptionsApplied,
    cardRegistryValid,
    checksumEntropyNormalized,
    tickEncoded,
    mlVectorArray,
  };

  return deepFreeze(vector) as BootstrapMLVector;
}

// ─────────────────────────────────────────────────────────────────────────────
// DL TENSOR CONSTRUCTION (6×6)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the 6×6 DL tensor from a bootstrap result.
 * Rows = [MODE, ECONOMY, SHIELD, BATTLE, CARDS, SOVEREIGNTY]
 * Columns = 6 features per domain.
 *
 * Usage:
 *   const tensor = buildBootstrapDLTensor(result, Date.now());
 */
export function buildBootstrapDLTensor(
  result: RunBootstrapResult,
  capturedAtMs: number,
): BootstrapDLTensor {
  const snapshot = result.snapshot;
  const mode = snapshot.mode;

  // Row 0 — MODE domain
  const modePrimary = isKnownMode(mode) ? (MODE_NORMALIZED[mode] ?? 0) : 0;
  const modeDiff = isKnownMode(mode)
    ? clamp01((MODE_DIFFICULTY_MULTIPLIER[mode] ?? 1) / 2)
    : 0.5;
  const modeTension = isKnownMode(mode)
    ? clamp01((MODE_TENSION_FLOOR[mode] ?? 0) / 100)
    : 0;
  const modePhaseEncoded = isKnownMode(mode) ? RUN_PHASE_NORMALIZED[snapshot.phase] ?? 0 : 0;
  const modeSeedEntropy = hashEntropy(snapshot.seed);
  const modeRunIdEntropy = hashEntropy(snapshot.runId);

  // Row 1 — ECONOMY domain
  const eco = extractEconomyMLFeatures(snapshot.economy);
  const econRow: readonly number[] = [
    eco.netWorthNormalized,
    eco.cashNormalized,
    eco.debtNormalized,
    eco.incomeNormalized,
    eco.freedomTargetProgress,
    eco.haterHeatNormalized,
  ];

  // Row 2 — SHIELD domain
  const shieldFeatures = extractShieldMLFeatures(snapshot.shield);
  const shieldRow: readonly number[] = [
    shieldFeatures.avgIntegrity,
    shieldFeatures.L1Integrity,
    shieldFeatures.L4Integrity,
    shieldFeatures.weakestLayerRatio,
    shieldFeatures.weakestLayerEncoded,
    shieldFeatures.breachCountNormalized,
  ];

  // Row 3 — BATTLE domain
  const battle = extractBattleMLFeatures(snapshot.battle);
  const battleRow: readonly number[] = [
    battle.activeBotCount,
    battle.neutralizedBotCount,
    battle.botThreatScore,
    battle.pendingAttackCount,
    battle.firstBloodClaimed,
    battle.battleBudgetNormalized,
  ];

  // Row 4 — CARDS domain
  const cards = extractCardsMLFeatures(snapshot.cards);
  const cardsRow: readonly number[] = [
    cards.handSizeNormalized,
    cards.drawPileSizeNormalized,
    cards.discardSizeNormalized,
    cards.exhaustSizeNormalized,
    cards.deckEntropyNormalized,
    cards.ghostMarkerCount,
  ];

  // Row 5 — SOVEREIGNTY domain
  const sov = extractSovereigntyMLFeatures(snapshot.sovereignty);
  const sovRow: readonly number[] = [
    sov.sovereigntyScoreNormalized,
    sov.integrityStatusRisk,
    sov.proofHashPresent,
    sov.verifiedGradeScore,
    sov.cordScoreNormalized,
    sov.auditFlagCount,
  ];

  const rows: readonly BootstrapDLTensorRow[] = Object.freeze([
    {
      domain: 'MODE',
      rowIndex: 0,
      features: Object.freeze([modePrimary, modeDiff, modeTension, modePhaseEncoded, modeSeedEntropy, modeRunIdEntropy]),
      featureNames: Object.freeze(['modeEncoded', 'difficulty', 'tensionFloor', 'phaseEncoded', 'seedEntropy', 'runIdEntropy']),
    },
    {
      domain: 'ECONOMY',
      rowIndex: 1,
      features: Object.freeze(econRow),
      featureNames: Object.freeze(['netWorth', 'cash', 'debt', 'income', 'freedomProgress', 'haterHeat']),
    },
    {
      domain: 'SHIELD',
      rowIndex: 2,
      features: Object.freeze(shieldRow),
      featureNames: Object.freeze(['avgIntegrity', 'L1Integrity', 'L4Integrity', 'weakestRatio', 'weakestEncoded', 'breachCount']),
    },
    {
      domain: 'BATTLE',
      rowIndex: 3,
      features: Object.freeze(battleRow),
      featureNames: Object.freeze(['activeBots', 'neutralizedBots', 'threatScore', 'pendingAttacks', 'firstBlood', 'budgetRatio']),
    },
    {
      domain: 'CARDS',
      rowIndex: 4,
      features: Object.freeze(cardsRow),
      featureNames: Object.freeze(['handSize', 'drawPile', 'discard', 'exhaust', 'deckEntropy', 'ghostMarkers']),
    },
    {
      domain: 'SOVEREIGNTY',
      rowIndex: 5,
      features: Object.freeze(sovRow),
      featureNames: Object.freeze(['sovereigntyScore', 'integrityRisk', 'proofHash', 'gradeScore', 'cordScore', 'auditFlags']),
    },
  ]);

  return deepFreeze({
    rows,
    shape: BOOTSTRAP_DL_TENSOR_SHAPE,
    domainOrder: BOOTSTRAP_DL_ROW_LABELS,
    capturedAtMs,
    runId: snapshot.runId,
    mode: snapshot.mode,
  }) as BootstrapDLTensor;
}

// ─────────────────────────────────────────────────────────────────────────────
// HEALTH SCORING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute a scalar health score [0, 1] for the bootstrap result.
 * Combines economy solvency, shield integrity, sovereignty score, and
 * pressure tier into a single confidence signal.
 */
export function computeBootstrapHealthScore(result: RunBootstrapResult): number {
  const snapshot = result.snapshot;

  const ecoScore =
    snapshot.economy.netWorth > 0
      ? clamp01(snapshot.economy.netWorth / (snapshot.economy.freedomTarget || 100_000))
      : 0;

  const shieldScore =
    snapshot.shield.layers.length > 0
      ? clamp01(
          snapshot.shield.layers.reduce((acc, l) => acc + l.integrityRatio, 0) /
            snapshot.shield.layers.length,
        )
      : 0;

  const sovereigntyScore = clamp01(snapshot.sovereignty.sovereigntyScore / 100);

  const pressurePenalty = isKnownPressureTier(snapshot.pressure.tier)
    ? PRESSURE_TIER_NORMALIZED[snapshot.pressure.tier]
    : 0;
  const pressureScore = 1 - pressurePenalty;

  const integrityPenalty =
    INTEGRITY_STATUS_RISK_SCORE[
      snapshot.sovereignty.integrityStatus as IntegrityStatus
    ] ?? 0.5;
  const integrityScore = 1 - integrityPenalty;

  return clamp01(
    ecoScore * 0.25 +
      shieldScore * 0.25 +
      sovereigntyScore * 0.1 +
      pressureScore * 0.2 +
      integrityScore * 0.2,
  );
}

/**
 * Classify bootstrap severity from a health score.
 */
export function classifyBootstrapSeverity(
  healthScore: number,
): BootstrapSeverity {
  if (healthScore >= BOOTSTRAP_SEVERITY_THRESHOLDS.NOMINAL_MIN_HEALTH_SCORE) {
    return 'NOMINAL';
  }
  if (
    healthScore >= BOOTSTRAP_SEVERITY_THRESHOLDS.DEGRADED_MIN_HEALTH_SCORE
  ) {
    return 'DEGRADED';
  }
  return 'CRITICAL';
}

/** Get an action recommendation string based on bootstrap health. */
export function getBootstrapActionRecommendation(
  result: RunBootstrapResult,
): string {
  const score = computeBootstrapHealthScore(result);
  const severity = classifyBootstrapSeverity(score);
  const mode = result.snapshot.mode;

  if (severity === 'NOMINAL') {
    return isKnownMode(mode)
      ? `${BOOTSTRAP_MODE_NARRATION[mode]} Foundation is solid.`
      : 'Run is clean. Proceed to tick execution.';
  }

  if (severity === 'DEGRADED') {
    return 'Opening state is fragile. Monitor pressure and shield integrity closely in early ticks.';
  }

  return 'CRITICAL: Opening state has severe deficiencies. Inspect shield, economy, and sovereignty before proceeding.';
}

// ─────────────────────────────────────────────────────────────────────────────
// CHAT SIGNAL CONSTRUCTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a BootstrapChatSignal from a bootstrap result.
 * This signal is consumed by RunBootstrapPipelineSignalAdapter → LIVEOPS routing.
 */
export function buildBootstrapChatSignal(
  result: RunBootstrapResult,
  durationMs: number,
  opts: {
    readonly modeOptionsApplied?: boolean;
    readonly cardRegistryValid?: boolean;
    readonly notes?: readonly string[];
  } = {},
): BootstrapChatSignal {
  const snapshot = result.snapshot;
  const healthScore = computeBootstrapHealthScore(result);
  const severity = classifyBootstrapSeverity(healthScore);
  const notes: string[] = [];

  if (opts.notes) {
    notes.push(...opts.notes);
  }

  if (!opts.modeOptionsApplied) {
    notes.push('Mode options were not explicitly configured; defaults applied.');
  }

  if (opts.cardRegistryValid === false) {
    notes.push('Card registry validation encountered issues.');
  }

  if (healthScore < BOOTSTRAP_SEVERITY_THRESHOLDS.NOMINAL_MIN_HEALTH_SCORE) {
    notes.push(
      `Opening health score ${healthScore.toFixed(3)} is below NOMINAL threshold.`,
    );
  }

  // Validate mode and outcome guards
  const _modeValid = isKnownMode(snapshot.mode);
  const _outcomeNull = !isKnownRunOutcome(snapshot.outcome as unknown);
  void _modeValid;
  void _outcomeNull;

  return Object.freeze({
    generatedAtMs: Date.now(),
    severity,
    runId: snapshot.runId,
    userId: snapshot.userId,
    mode: snapshot.mode,
    phase: snapshot.phase,
    seed: snapshot.seed,
    tick: snapshot.tick,
    openingChecksum: result.openingChecksum,
    handSize: snapshot.cards.hand.length,
    drawPileSize: snapshot.cards.drawPileSize,
    pressureTier: snapshot.pressure.tier,
    pressureBand: snapshot.pressure.band as PressureBand,
    integrityStatus: snapshot.sovereignty.integrityStatus as IntegrityStatus,
    sovereigntyScore: snapshot.sovereignty.sovereigntyScore,
    modeOptionsApplied: opts.modeOptionsApplied ?? false,
    cardRegistryValid: opts.cardRegistryValid !== false,
    bootstrapDurationMs: durationMs,
    notes: Object.freeze(notes),
    narrationHint: isKnownMode(snapshot.mode)
      ? BOOTSTRAP_MODE_NARRATION[snapshot.mode]
      : 'Run begins.',
    mlHealthScore: healthScore,
  }) as BootstrapChatSignal;
}

// ─────────────────────────────────────────────────────────────────────────────
// ANNOTATION BUILDER
// ─────────────────────────────────────────────────────────────────────────────

const BOOTSTRAP_MODE_DISPLAY: Readonly<Record<ModeCode, string>> = Object.freeze({
  solo: 'Empire — GO ALONE',
  pvp: 'Predator — HEAD TO HEAD',
  coop: 'Syndicate — TEAM UP',
  ghost: 'Phantom — CHASE A LEGEND',
});

/**
 * Build an annotation bundle for the chat lane / companion output surface.
 * All fields are human-readable and UX-targeted.
 */
export function buildBootstrapAnnotation(
  result: RunBootstrapResult,
  healthScore: number,
  severity: BootstrapSeverity,
): BootstrapAnnotationBundle {
  const snapshot = result.snapshot;
  const mode = snapshot.mode;
  const criticalFlags: string[] = [];
  const warningFlags: string[] = [];
  const infoFlags: string[] = [];

  // Economy assessment
  if (snapshot.economy.netWorth <= 0) {
    criticalFlags.push('Economy starts at zero or negative net worth.');
  } else if (snapshot.economy.netWorth < 5_000) {
    warningFlags.push('Opening net worth is very low.');
  }

  if (snapshot.economy.debt > snapshot.economy.cash) {
    warningFlags.push('Debt exceeds available cash at bootstrap.');
  }

  // Pressure assessment
  if (
    isKnownPressureTier(snapshot.pressure.tier) &&
    PRESSURE_TIER_NORMALIZED[snapshot.pressure.tier] > 0.5
  ) {
    criticalFlags.push(
      `Opening pressure tier ${snapshot.pressure.tier} is elevated.`,
    );
  }

  // Shield assessment
  const avgShield =
    snapshot.shield.layers.length > 0
      ? snapshot.shield.layers.reduce((acc, l) => acc + l.integrityRatio, 0) /
        snapshot.shield.layers.length
      : 0;

  if (avgShield < 0.5) {
    criticalFlags.push('Shield integrity is critically low at start.');
  } else if (avgShield < 0.8) {
    warningFlags.push('Shield integrity is below optimal at start.');
  }

  // Sovereignty assessment
  if (snapshot.sovereignty.integrityStatus === 'QUARANTINED') {
    criticalFlags.push('Sovereignty integrity is QUARANTINED at start.');
  } else if (snapshot.sovereignty.integrityStatus === 'UNVERIFIED') {
    warningFlags.push('Sovereignty integrity is UNVERIFIED at bootstrap.');
  }

  // Bot threat assessment
  const activeBots = snapshot.battle.bots.filter((b) => !b.neutralized);
  if (activeBots.length === HATER_BOT_IDS.length) {
    warningFlags.push(`All ${activeBots.length} hater bots are active.`);
  }

  // Card assessment
  infoFlags.push(
    `Opening hand: ${snapshot.cards.hand.length} cards. Draw pile: ${snapshot.cards.drawPileSize}.`,
  );

  const modeDisplay = isKnownMode(mode)
    ? (BOOTSTRAP_MODE_DISPLAY[mode] ?? mode)
    : mode;
  const narration = isKnownMode(mode) ? BOOTSTRAP_MODE_NARRATION[mode] : '';

  const audienceHeat =
    severity === 'CRITICAL'
      ? 'MAX HEAT'
      : severity === 'DEGRADED'
        ? 'ELEVATED'
        : 'READY';

  return Object.freeze({
    capturedAtMs: Date.now(),
    severity,
    companionHeadline: `${modeDisplay} — Run ${snapshot.runId.slice(0, 8)} begins.`,
    companionSubtext:
      criticalFlags.length > 0
        ? criticalFlags[0]
        : warningFlags.length > 0
          ? warningFlags[0]
          : 'All systems nominal.',
    operatorSummary: `Health: ${(healthScore * 100).toFixed(1)}%. Severity: ${severity}. Mode: ${modeDisplay}.`,
    audienceHeatLabel: audienceHeat,
    narrationHint: narration,
    mode,
    modeDisplayName: modeDisplay,
    openingHandSummary: `${snapshot.cards.hand.length} cards / ${snapshot.cards.drawPileSize} in draw pile`,
    economySummary: `$${snapshot.economy.netWorth.toLocaleString()} net worth / $${snapshot.economy.cash.toLocaleString()} cash`,
    pressureSummary: `Tier ${snapshot.pressure.tier} / Score ${(snapshot.pressure.score * 100).toFixed(0)}%`,
    shieldSummary: `Avg integrity ${(avgShield * 100).toFixed(0)}% / Weakest: ${snapshot.shield.weakestLayerId}`,
    sovereigntySummary: `Score ${snapshot.sovereignty.sovereigntyScore.toFixed(0)} / ${snapshot.sovereignty.integrityStatus}`,
    criticalFlags: Object.freeze(criticalFlags),
    warningFlags: Object.freeze(warningFlags),
    infoFlags: Object.freeze(infoFlags),
  }) as BootstrapAnnotationBundle;
}

// ─────────────────────────────────────────────────────────────────────────────
// NARRATION HINT BRIDGE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a narration hint for the chat companion based on mode and severity.
 * This feeds into the chat system's presence theater and audience heat.
 */
export function buildBootstrapNarrationHint(
  result: RunBootstrapResult,
  healthScore: number,
): BootstrapNarrationHint {
  const snapshot = result.snapshot;
  const mode = snapshot.mode;
  const severity = classifyBootstrapSeverity(healthScore);

  const urgency: BootstrapNarrationHint['urgency'] =
    severity === 'CRITICAL'
      ? 'high'
      : severity === 'DEGRADED'
        ? 'medium'
        : 'low';

  const audienceHeat = 1 - healthScore; // inverse: more health = less heat at start
  const rescueEligible = healthScore < 0.5;

  const presenceSignal =
    urgency === 'high'
      ? 'RESCUE_NEEDED'
      : urgency === 'medium'
        ? 'WATCH_CLOSELY'
        : 'CLEAN_START';

  const relationshipTag = mode === 'pvp' ? 'RIVAL' : mode === 'coop' ? 'ALLY' : 'SELF';

  const headline = isKnownMode(mode) ? BOOTSTRAP_MODE_NARRATION[mode] : 'Run starts.';
  const subtext = getBootstrapActionRecommendation(result);

  return Object.freeze({
    runId: snapshot.runId,
    mode,
    headline,
    subtext,
    urgency,
    audienceHeat: clamp01(audienceHeat),
    rescueEligible,
    presenceSignal,
    relationshipTag,
  }) as BootstrapNarrationHint;
}

// ─────────────────────────────────────────────────────────────────────────────
// RUN SUMMARY BUILDER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the bootstrap run summary — a complete record suitable for persistence.
 * Includes verifiedGrade and outcomeReasonCode from telemetry state.
 */
export function buildBootstrapRunSummary(
  result: RunBootstrapResult,
  sessionId: string,
  bootstrapDurationMs: number,
): BootstrapRunSummary {
  const snapshot = result.snapshot;
  const healthScore = computeBootstrapHealthScore(result);
  const severity = classifyBootstrapSeverity(healthScore);

  const rawGrade = snapshot.sovereignty.verifiedGrade as VerifiedGrade | null;
  const verifiedGrade =
    rawGrade != null &&
    VERIFIED_GRADE_NUMERIC_SCORE[rawGrade] != null
      ? rawGrade
      : null;

  const outcomeReasonCode =
    (snapshot.telemetry.outcomeReasonCode as OutcomeReasonCode | null) ?? null;

  return Object.freeze({
    sessionId,
    runId: snapshot.runId,
    userId: snapshot.userId,
    mode: snapshot.mode,
    phase: snapshot.phase as RunPhase,
    seed: snapshot.seed,
    openingChecksum: result.openingChecksum,
    severity,
    healthScore,
    bootstrapDurationMs,
    handSize: snapshot.cards.hand.length,
    drawPileSize: snapshot.cards.drawPileSize,
    pressureTier: snapshot.pressure.tier as PressureTier,
    sovereigntyScore: snapshot.sovereignty.sovereigntyScore,
    integrityStatus: snapshot.sovereignty.integrityStatus as IntegrityStatus,
    verifiedGrade,
    outcomeAtBootstrap: snapshot.outcome as RunOutcome | null,
    outcomeReasonCode,
    modeOptionsApplied: false,
    schemaVersion: BOOTSTRAP_SCHEMA_VERSION,
    bootstrappedAtMs: Date.now(),
  }) as BootstrapRunSummary;
}

// ─────────────────────────────────────────────────────────────────────────────
// ML VECTOR UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate that a BootstrapMLVector is structurally complete.
 * All 32 features must be finite numbers in [0, 1].
 */
export function validateBootstrapMLVector(vec: BootstrapMLVector): boolean {
  if (vec.mlVectorArray.length !== BOOTSTRAP_ML_FEATURE_COUNT) return false;
  return vec.mlVectorArray.every((v) => Number.isFinite(v) && v >= 0 && v <= 1);
}

/**
 * Flatten a BootstrapDLTensor into a 1-D array (row-major).
 */
export function flattenBootstrapDLTensor(tensor: BootstrapDLTensor): readonly number[] {
  const flat: number[] = [];
  for (const row of tensor.rows) {
    flat.push(...row.features);
  }
  return Object.freeze(flat);
}

/**
 * Build a named map from a BootstrapMLVector for human-readable inspection.
 */
export function buildBootstrapMLNamedMap(
  vec: BootstrapMLVector,
): Readonly<Record<string, number>> {
  const result: Record<string, number> = {};
  BOOTSTRAP_ML_FEATURE_LABELS.forEach((label, i) => {
    result[label] = vec.mlVectorArray[i] ?? 0;
  });
  return Object.freeze(result);
}

/**
 * Extract a single column from a BootstrapDLTensor (all rows at a given column index).
 */
export function extractBootstrapDLColumn(
  tensor: BootstrapDLTensor,
  colIndex: number,
): readonly number[] {
  return Object.freeze(tensor.rows.map((row) => row.features[colIndex] ?? 0));
}

/**
 * Compute cosine similarity between two BootstrapMLVectors.
 * Returns [0, 1] — 1.0 = identical feature vectors.
 */
export function computeBootstrapMLSimilarity(
  a: BootstrapMLVector,
  b: BootstrapMLVector,
): number {
  const va = a.mlVectorArray;
  const vb = b.mlVectorArray;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < va.length && i < vb.length; i++) {
    dot += (va[i] ?? 0) * (vb[i] ?? 0);
    magA += (va[i] ?? 0) ** 2;
    magB += (vb[i] ?? 0) ** 2;
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : clamp01(dot / denom);
}

/**
 * Get the top-N features by absolute value from a BootstrapMLVector.
 */
export function getTopBootstrapFeatures(
  vec: BootstrapMLVector,
  topN: number = 5,
): ReadonlyArray<{ readonly label: string; readonly value: number }> {
  const pairs = BOOTSTRAP_ML_FEATURE_LABELS.map((label, i) => ({
    label,
    value: vec.mlVectorArray[i] ?? 0,
  }));
  pairs.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  return Object.freeze(pairs.slice(0, topN));
}

// ─────────────────────────────────────────────────────────────────────────────
// TREND ANALYZER CLASS
// ─────────────────────────────────────────────────────────────────────────────

interface TrendRecord {
  readonly ts: number;
  readonly healthScore: number;
  readonly severity: BootstrapSeverity;
  readonly mode: ModeCode;
  readonly mlVector: readonly number[];
  readonly runId: string;
}

/**
 * BootstrapTrendAnalyzer
 *
 * Tracks ML feature drift across multiple bootstrap attempts within a session.
 * Produces BootstrapTrendSnapshot for the chat lane and inspection bundles.
 */
export class BootstrapTrendAnalyzer {
  private readonly _records: TrendRecord[] = [];
  private readonly _windowMs: number;
  private readonly _capacity: number;

  public constructor(opts: { windowMs?: number; capacity?: number } = {}) {
    this._windowMs = opts.windowMs ?? 300_000; // 5 minutes
    this._capacity = opts.capacity ?? 100;
  }

  public addRecord(
    result: RunBootstrapResult,
    healthScore: number,
    severity: BootstrapSeverity,
  ): void {
    const snapshot = result.snapshot;
    const mlVec = extractBootstrapMLVector(result, 0);
    const record: TrendRecord = cloneJson({
      ts: Date.now(),
      healthScore,
      severity,
      mode: snapshot.mode,
      mlVector: mlVec.mlVectorArray.slice(),
      runId: snapshot.runId,
    });
    this._records.push(record);
    if (this._records.length > this._capacity) {
      this._records.shift();
    }
  }

  public getSnapshot(): BootstrapTrendSnapshot {
    const now = Date.now();
    const windowStart = now - this._windowMs;
    const windowed = this._records.filter((r) => r.ts >= windowStart);
    const n = windowed.length;

    if (n === 0) {
      return this._emptyTrend(now);
    }

    const avgHealthScore = windowed.reduce((a, r) => a + r.healthScore, 0) / n;
    const minHealthScore = Math.min(...windowed.map((r) => r.healthScore));
    const maxHealthScore = Math.max(...windowed.map((r) => r.healthScore));

    // Per-mode distribution
    const modeDistribution: Partial<Record<ModeCode, number>> = {};
    for (const code of BOOTSTRAP_ALL_MODES) {
      modeDistribution[code] = windowed.filter((r) => r.mode === code).length;
    }

    // Severity fractions
    const nominalCount = windowed.filter((r) => r.severity === 'NOMINAL').length;
    const degradedCount = windowed.filter((r) => r.severity === 'DEGRADED').length;
    const criticalCount = windowed.filter((r) => r.severity === 'CRITICAL').length;

    // Average key ML features
    const avgML = (featureIdx: number): number =>
      windowed.reduce((a, r) => a + (r.mlVector[featureIdx] ?? 0), 0) / n;

    // Trend determination (last 3 vs first 3)
    const trend = this._computeTrend(windowed);

    return Object.freeze({
      capturedAt: now,
      sampleCount: n,
      windowMs: this._windowMs,
      avgHealthScore,
      minHealthScore,
      maxHealthScore,
      avgHandSize: avgML(5), // handSizeNormalized index 5
      avgDrawPileSize: avgML(6), // drawPileSizeNormalized index 6
      avgEconomyNetWorth: avgML(11), // economyNetWorthNormalized index 11
      avgPressureTierEncoded: avgML(15), // pressureTierEncoded index 15
      avgBotThreatScore: avgML(24), // botThreatScore index 24
      avgSovereigntyScore: avgML(26), // sovereigntyScoreNormalized index 26
      nominalFraction: n > 0 ? nominalCount / n : 0,
      degradedFraction: n > 0 ? degradedCount / n : 0,
      criticalFraction: n > 0 ? criticalCount / n : 0,
      modeDistribution: modeDistribution as Readonly<Record<ModeCode, number>>,
      trend,
    }) as BootstrapTrendSnapshot;
  }

  public getSampleCount(): number {
    return this._records.length;
  }

  public clear(): void {
    this._records.length = 0;
  }

  private _computeTrend(
    records: readonly TrendRecord[],
  ): 'IMPROVING' | 'STABLE' | 'DEGRADING' {
    if (records.length < 4) return 'STABLE';
    const half = Math.floor(records.length / 2);
    const firstHalfAvg =
      records.slice(0, half).reduce((a, r) => a + r.healthScore, 0) / half;
    const secondHalfAvg =
      records.slice(half).reduce((a, r) => a + r.healthScore, 0) /
      (records.length - half);
    const delta = secondHalfAvg - firstHalfAvg;
    if (delta > 0.05) return 'IMPROVING';
    if (delta < -0.05) return 'DEGRADING';
    return 'STABLE';
  }

  private _emptyTrend(now: number): BootstrapTrendSnapshot {
    const emptyModeDistribution: Partial<Record<ModeCode, number>> = {};
    for (const code of BOOTSTRAP_ALL_MODES) {
      emptyModeDistribution[code] = 0;
    }
    return Object.freeze({
      capturedAt: now,
      sampleCount: 0,
      windowMs: this._windowMs,
      avgHealthScore: 0,
      minHealthScore: 0,
      maxHealthScore: 0,
      avgHandSize: 0,
      avgDrawPileSize: 0,
      avgEconomyNetWorth: 0,
      avgPressureTierEncoded: 0,
      avgBotThreatScore: 0,
      avgSovereigntyScore: 0,
      nominalFraction: 0,
      degradedFraction: 0,
      criticalFraction: 0,
      modeDistribution: emptyModeDistribution as Readonly<Record<ModeCode, number>>,
      trend: 'STABLE',
    }) as BootstrapTrendSnapshot;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SESSION TRACKER CLASS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * BootstrapSessionTracker
 *
 * Tracks all bootstrap attempts within a session. Provides aggregate
 * stats for the session report used by inspection bundles and chat adapters.
 */
export class BootstrapSessionTracker {
  private readonly _sessionId: string;
  private readonly _startedAtMs: number;
  private readonly _records: BootstrapTelemetryRecord[] = [];
  private _failedCount = 0;

  public constructor(sessionId: string) {
    this._sessionId = sessionId;
    this._startedAtMs = Date.now();
  }

  public get sessionId(): string {
    return this._sessionId;
  }

  public record(
    result: RunBootstrapResult,
    durationMs: number,
    opts: { readonly modeOptionsApplied?: boolean; readonly cardRegistryValid?: boolean } = {},
  ): void {
    const snapshot = result.snapshot;
    const healthScore = computeBootstrapHealthScore(result);
    const severity = classifyBootstrapSeverity(healthScore);
    const mlVec = extractBootstrapMLVector(result, durationMs, opts);

    const entry: BootstrapTelemetryRecord = cloneJson({
      ts: Date.now(),
      runId: snapshot.runId,
      mode: snapshot.mode,
      durationMs,
      severity,
      healthScore,
      handSize: snapshot.cards.hand.length,
      drawPileSize: snapshot.cards.drawPileSize,
      pressureTier: snapshot.pressure.tier,
      botThreatScore: mlVec.botThreatScore,
      sovereigntyScore: snapshot.sovereignty.sovereigntyScore,
      openingChecksum: result.openingChecksum,
      mlVector: mlVec.mlVectorArray.slice(),
    });

    this._records.push(entry);
  }

  public recordFailure(): void {
    this._failedCount++;
  }

  public getReport(): BootstrapSessionReport {
    const now = Date.now();
    const n = this._records.length;

    if (n === 0) {
      return this._emptyReport(now);
    }

    const avgHealth = this._records.reduce((a, r) => a + r.healthScore, 0) / n;
    const minHealth = Math.min(...this._records.map((r) => r.healthScore));
    const maxHealth = Math.max(...this._records.map((r) => r.healthScore));
    const avgDuration = this._records.reduce((a, r) => a + r.durationMs, 0) / n;
    const maxDuration = Math.max(...this._records.map((r) => r.durationMs));

    const modesBootstrapped = Array.from(
      new Set(this._records.map((r) => r.mode)),
    );
    const runIdsSeen = Array.from(new Set(this._records.map((r) => r.runId)));

    return Object.freeze({
      sessionId: this._sessionId,
      startedAtMs: this._startedAtMs,
      capturedAtMs: now,
      totalBootstraps: n + this._failedCount,
      successfulBootstraps: n,
      failedBootstraps: this._failedCount,
      avgHealthScore: avgHealth,
      minHealthScore: minHealth,
      maxHealthScore: maxHealth,
      avgDurationMs: avgDuration,
      maxDurationMs: maxDuration,
      nominalCount: this._records.filter((r) => r.severity === 'NOMINAL').length,
      degradedCount: this._records.filter((r) => r.severity === 'DEGRADED').length,
      criticalCount: this._records.filter((r) => r.severity === 'CRITICAL').length,
      modesBootstrapped: Object.freeze(modesBootstrapped),
      runIdsSeen: Object.freeze(runIdsSeen),
      lastBootstrapAtMs: this._records[this._records.length - 1]?.ts ?? null,
    }) as BootstrapSessionReport;
  }

  public clear(): void {
    this._records.length = 0;
    this._failedCount = 0;
  }

  private _emptyReport(now: number): BootstrapSessionReport {
    return Object.freeze({
      sessionId: this._sessionId,
      startedAtMs: this._startedAtMs,
      capturedAtMs: now,
      totalBootstraps: this._failedCount,
      successfulBootstraps: 0,
      failedBootstraps: this._failedCount,
      avgHealthScore: 0,
      minHealthScore: 0,
      maxHealthScore: 0,
      avgDurationMs: 0,
      maxDurationMs: 0,
      nominalCount: 0,
      degradedCount: 0,
      criticalCount: 0,
      modesBootstrapped: Object.freeze([]),
      runIdsSeen: Object.freeze([]),
      lastBootstrapAtMs: null,
    }) as BootstrapSessionReport;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EVENT LOG CLASS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * BootstrapEventLog
 *
 * Immutable ordered log of bootstrap lifecycle phases.
 * Each phase is checksummed using checksumParts() for audit integrity.
 *
 * Phases:
 *   NORMALIZE → REGISTRY_RESET → BUS_CLEAR → FACTORY → MODE_CONFIGURE →
 *   IDENTITY_ASSERT → CARD_ASSERT → FREEZE → CHECKSUM → EMIT → COMPLETE
 */
export class BootstrapEventLog {
  private readonly _entries: BootstrapEventLogEntry[] = [];
  private readonly _capacity: number;
  private _sequence = 0;
  private _lastTs: number = 0;

  public constructor(opts: { capacity?: number } = {}) {
    this._capacity = opts.capacity ?? 200;
  }

  public recordPhase(
    phase: BootstrapPhaseName,
    runId: string | null,
    data: Record<string, unknown>,
  ): BootstrapEventLogEntry {
    const ts = Date.now();
    const durationMs = this._lastTs > 0 ? ts - this._lastTs : 0;
    const checksum = checksumParts(phase, runId ?? '', ts, JSON.stringify(data));
    const entry: BootstrapEventLogEntry = Object.freeze({
      sequence: this._sequence++,
      phase,
      ts,
      durationMs,
      checksum,
      runId,
      data: Object.freeze(cloneJson(data)),
    });
    this._entries.push(entry);
    this._lastTs = ts;
    if (this._entries.length > this._capacity) {
      this._entries.shift();
    }
    return entry;
  }

  public getAll(): readonly BootstrapEventLogEntry[] {
    return Object.freeze([...this._entries]);
  }

  public getByPhase(phase: BootstrapPhaseName): readonly BootstrapEventLogEntry[] {
    return Object.freeze(this._entries.filter((e) => e.phase === phase));
  }

  public getLatest(n: number): readonly BootstrapEventLogEntry[] {
    return Object.freeze(this._entries.slice(-n));
  }

  public size(): number {
    return this._entries.length;
  }

  public clear(): void {
    this._entries.length = 0;
    this._sequence = 0;
    this._lastTs = 0;
  }

  public buildAuditDigest(): Readonly<Record<string, number>> {
    const counts: Partial<Record<BootstrapPhaseName, number>> = {};
    for (const entry of this._entries) {
      counts[entry.phase] = (counts[entry.phase] ?? 0) + 1;
    }
    return Object.freeze(counts) as Readonly<Record<string, number>>;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ANNOTATOR CLASS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * BootstrapAnnotator
 *
 * Builds annotation bundles and narration hints from bootstrap results.
 * Stateless — all methods are pure with respect to external state.
 */
export class BootstrapAnnotator {
  public buildAnnotation(
    result: RunBootstrapResult,
    healthScore: number,
    severity: BootstrapSeverity,
  ): BootstrapAnnotationBundle {
    return buildBootstrapAnnotation(result, healthScore, severity);
  }

  public buildNarrationHint(
    result: RunBootstrapResult,
    healthScore: number,
  ): BootstrapNarrationHint {
    return buildBootstrapNarrationHint(result, healthScore);
  }

  public buildChatSignal(
    result: RunBootstrapResult,
    durationMs: number,
    opts: {
      readonly modeOptionsApplied?: boolean;
      readonly cardRegistryValid?: boolean;
      readonly notes?: readonly string[];
    } = {},
  ): BootstrapChatSignal {
    return buildBootstrapChatSignal(result, durationMs, opts);
  }

  public scoreHealth(result: RunBootstrapResult): number {
    return computeBootstrapHealthScore(result);
  }

  public classifySeverity(healthScore: number): BootstrapSeverity {
    return classifyBootstrapSeverity(healthScore);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// INSPECTOR CLASS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * BootstrapInspector
 *
 * Builds full inspection bundles from a bootstrap result plus analytics subsystems.
 * Inspection bundles combine ML vector, DL tensor, chat signal, annotations,
 * narration hints, trend snapshot, session report, event log, and tick seal.
 */
export class BootstrapInspector {
  private readonly _annotator: BootstrapAnnotator;

  public constructor() {
    this._annotator = new BootstrapAnnotator();
  }

  public buildInspectionBundle(
    result: RunBootstrapResult,
    durationMs: number,
    opts: {
      readonly sessionTracker: BootstrapSessionTracker;
      readonly trendAnalyzer: BootstrapTrendAnalyzer;
      readonly eventLog: BootstrapEventLog;
      readonly registrySnapshot?: EngineRegistrySnapshot | null;
      readonly modeOptionsApplied?: boolean;
      readonly cardRegistryValid?: boolean;
    },
  ): BootstrapInspectionBundle {
    const healthScore = computeBootstrapHealthScore(result);
    const severity = classifyBootstrapSeverity(healthScore);
    const mlVector = extractBootstrapMLVector(result, durationMs, {
      modeOptionsApplied: opts.modeOptionsApplied,
      cardRegistryValid: opts.cardRegistryValid,
    });
    const dlTensor = buildBootstrapDLTensor(result, Date.now());
    const chatSignal = this._annotator.buildChatSignal(result, durationMs, {
      modeOptionsApplied: opts.modeOptionsApplied,
      cardRegistryValid: opts.cardRegistryValid,
    });
    const annotation = this._annotator.buildAnnotation(result, healthScore, severity);
    const narrationHint = this._annotator.buildNarrationHint(result, healthScore);
    const trendSnapshot = opts.trendAnalyzer.getSampleCount() > 0
      ? opts.trendAnalyzer.getSnapshot()
      : null;
    const sessionReport = opts.sessionTracker.getReport();
    const eventLog = opts.eventLog.getAll();
    const tickSeal = buildBootstrapTickSeal(
      result.snapshot.runId,
      result.snapshot.seed,
      result.openingChecksum,
    );

    return Object.freeze({
      capturedAtMs: Date.now(),
      runId: result.snapshot.runId,
      severity,
      healthScore,
      mlVector,
      dlTensor,
      chatSignal,
      annotation,
      narrationHint,
      trendSnapshot,
      sessionReport,
      eventLog,
      registrySnapshot: opts.registrySnapshot ?? null,
      tickSeal,
      durationMs,
    }) as BootstrapInspectionBundle;
  }

  public buildExportBundle(
    result: RunBootstrapResult,
    durationMs: number,
    sessionId: string,
    opts: {
      readonly sessionTracker: BootstrapSessionTracker;
      readonly trendAnalyzer: BootstrapTrendAnalyzer;
      readonly eventLog: BootstrapEventLog;
      readonly modeOptionsApplied?: boolean;
      readonly cardRegistryValid?: boolean;
    },
  ): BootstrapExportBundle {
    const healthScore = computeBootstrapHealthScore(result);
    const severity = classifyBootstrapSeverity(healthScore);
    const mlVector = extractBootstrapMLVector(result, durationMs, {
      modeOptionsApplied: opts.modeOptionsApplied,
      cardRegistryValid: opts.cardRegistryValid,
    });
    const dlTensor = buildBootstrapDLTensor(result, Date.now());
    const chatSignal = this._annotator.buildChatSignal(result, durationMs, {
      modeOptionsApplied: opts.modeOptionsApplied,
      cardRegistryValid: opts.cardRegistryValid,
    });
    const annotation = this._annotator.buildAnnotation(result, healthScore, severity);
    const narrationHint = this._annotator.buildNarrationHint(result, healthScore);
    const trendSnapshot = opts.trendAnalyzer.getSampleCount() > 0
      ? opts.trendAnalyzer.getSnapshot()
      : null;
    const sessionReport = opts.sessionTracker.getReport();
    const eventLog = opts.eventLog.getAll();
    const runSummary = buildBootstrapRunSummary(result, sessionId, durationMs);
    const tickSeal = buildBootstrapTickSeal(
      result.snapshot.runId,
      result.snapshot.seed,
      result.openingChecksum,
    );

    return Object.freeze({
      schemaVersion: BOOTSTRAP_SCHEMA_VERSION,
      moduleVersion: BOOTSTRAP_MODULE_VERSION,
      exportedAtMs: Date.now(),
      runId: result.snapshot.runId,
      mode: result.snapshot.mode,
      severity,
      healthScore,
      mlVector,
      dlTensor,
      chatSignal,
      annotation,
      narrationHint,
      runSummary,
      eventLog,
      trendSnapshot,
      sessionReport,
      tickSeal,
    }) as BootstrapExportBundle;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE: RunBootstrapPipeline (ENHANCED)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * RunBootstrapPipeline
 *
 * Authoritative run bootstrap orchestrator for Engine Zero.
 *
 * Responsibilities:
 * - Normalizes input: runId/seed auto-generated if not provided
 * - Resets EngineRegistry volatile state
 * - Clears EventBus queue/history (optionally preserves listeners)
 * - Calls RunStateFactory.createInitialRunState()
 * - Applies mode configuration through ModeRegistry
 * - Validates canonical identity (runId/userId/seed/mode consistency)
 * - Validates opening hand against CardRegistry
 * - Produces deterministic openingChecksum via checksumSnapshot()
 * - Emits run.started event to EventBus
 * - Exposes ML/DL extraction, chat signals, annotations, narration hints,
 *   inspection bundles, and export bundles via dedicated methods
 *
 * Not responsible for:
 * - Tick execution
 * - Run shutdown
 * - Persistence
 * - Transport
 * - Frontend rendering
 */
export class RunBootstrapPipeline {
  private readonly bus: EventBus<RuntimeEventMap>;

  private readonly registry: EngineRegistry;

  private readonly modeRegistry: ModeRegistry;

  private readonly cardRegistry: CardRegistry;

  private readonly now: () => number;

  private readonly _eventLog: BootstrapEventLog;

  private readonly _annotator: BootstrapAnnotator;

  private _lastResult: RunBootstrapResult | null = null;

  private _lastDurationMs = 0;

  private _lastModeOptionsApplied = false;

  private _lastCardRegistryValid = true;

  public constructor(dependencies: RunBootstrapPipelineDependencies) {
    this.bus = dependencies.bus;
    this.registry = dependencies.registry;
    this.modeRegistry = dependencies.modeRegistry ?? DEFAULT_MODE_REGISTRY;
    this.cardRegistry = dependencies.cardRegistry ?? new CardRegistry();
    this.now = dependencies.now ?? (() => Date.now());
    this._eventLog = new BootstrapEventLog();
    this._annotator = new BootstrapAnnotator();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // BOOTSTRAP — PRIMARY ENTRY POINT
  // ─────────────────────────────────────────────────────────────────────────

  public bootstrap(input: RunBootstrapInput): RunBootstrapResult {
    const startMs = this.now();

    // Phase: NORMALIZE
    const normalized = this.normalizeInput(input);
    this._eventLog.recordPhase(BOOTSTRAP_PHASE_NAMES.NORMALIZE, null, {
      runId: normalized.factoryInput.runId,
      mode: normalized.factoryInput.mode,
      modeOptionsProvided: normalized.modeOptions != null,
    });

    // Phase: REGISTRY_RESET
    this.registry.reset();
    this._eventLog.recordPhase(BOOTSTRAP_PHASE_NAMES.REGISTRY_RESET, normalized.factoryInput.runId, {
      registryReset: true,
    });

    // Phase: BUS_CLEAR
    this.bus.clear({
      clearQueue: true,
      clearHistory: true,
      clearListeners: normalized.preserveBusListeners !== true ? true : false,
      clearAnyListeners:
        normalized.preserveBusAnyListeners !== true ? true : false,
    });
    this._eventLog.recordPhase(BOOTSTRAP_PHASE_NAMES.BUS_CLEAR, normalized.factoryInput.runId, {
      preservedListeners: normalized.preserveBusListeners,
      preservedAnyListeners: normalized.preserveBusAnyListeners,
    });

    // Phase: FACTORY
    let snapshot = createInitialRunState(normalized.factoryInput);
    this._eventLog.recordPhase(BOOTSTRAP_PHASE_NAMES.FACTORY, snapshot.runId, {
      tick: snapshot.tick,
      phase: snapshot.phase,
      mode: snapshot.mode,
    });

    // Phase: MODE_CONFIGURE
    const modeAdapter = this.modeRegistry.mustGet(snapshot.mode);
    this._lastModeOptionsApplied = normalized.modeOptions != null;
    snapshot = modeAdapter.configure(snapshot, normalized.modeOptions);
    snapshot = this.assertCanonicalIdentity(snapshot, normalized.factoryInput);
    this._eventLog.recordPhase(BOOTSTRAP_PHASE_NAMES.MODE_CONFIGURE, snapshot.runId, {
      modeOptionsApplied: this._lastModeOptionsApplied,
    });

    // Phase: IDENTITY_ASSERT
    this._eventLog.recordPhase(BOOTSTRAP_PHASE_NAMES.IDENTITY_ASSERT, snapshot.runId, {
      runIdMatch: snapshot.runId === normalized.factoryInput.runId,
      userIdMatch: snapshot.userId === normalized.factoryInput.userId,
      seedMatch: snapshot.seed === normalized.factoryInput.seed,
      modeMatch: snapshot.mode === normalized.factoryInput.mode,
    });

    // Phase: CARD_ASSERT
    try {
      this.assertOpeningCards(snapshot);
      this._lastCardRegistryValid = true;
    } catch (err) {
      this._lastCardRegistryValid = false;
      throw err;
    }
    this._eventLog.recordPhase(BOOTSTRAP_PHASE_NAMES.CARD_ASSERT, snapshot.runId, {
      handSize: snapshot.cards.hand.length,
      cardRegistryValid: this._lastCardRegistryValid,
    });

    // Phase: FREEZE
    const frozen = deepFrozenClone(snapshot);
    this._eventLog.recordPhase(BOOTSTRAP_PHASE_NAMES.FREEZE, frozen.runId, {
      frozen: true,
      tick: frozen.tick,
    });

    // Phase: CHECKSUM
    const openingChecksum = checksumSnapshot({
      runId: frozen.runId,
      seed: frozen.seed,
      mode: frozen.mode,
      tick: frozen.tick,
      phase: frozen.phase,
      economy: frozen.economy,
      pressure: frozen.pressure,
      tension: frozen.tension,
      shield: frozen.shield,
      battle: {
        ...frozen.battle,
        pendingAttacks: frozen.battle.pendingAttacks.map(
          (attack) => attack.attackId,
        ),
      },
      cards: {
        hand: frozen.cards.hand.map((card) => card.definitionId),
        discard: frozen.cards.discard,
        exhaust: frozen.cards.exhaust,
        drawPileSize: frozen.cards.drawPileSize,
      },
      modeState: frozen.modeState,
      timers: frozen.timers,
      tags: frozen.tags,
    });
    this._eventLog.recordPhase(BOOTSTRAP_PHASE_NAMES.CHECKSUM, frozen.runId, {
      checksumLength: openingChecksum.length,
    });

    // Phase: EMIT
    const startedEvent = this.bus.emit(
      'run.started',
      {
        runId: frozen.runId,
        mode: frozen.mode,
        seed: frozen.seed,
      },
      {
        emittedAtTick: frozen.tick,
        tags: freezeArray([
          'engine-zero',
          'run-bootstrap',
          `mode:${frozen.mode}`,
          `run:${frozen.runId}`,
        ]),
      },
    );
    this._eventLog.recordPhase(BOOTSTRAP_PHASE_NAMES.EMIT, frozen.runId, {
      eventEmitted: 'run.started',
    });

    const result: RunBootstrapResult = {
      snapshot: frozen,
      modeAdapter,
      openingChecksum,
      startedEvent,
    };

    this._lastDurationMs = this.now() - startMs;
    this._lastResult = result;

    // Phase: COMPLETE
    this._eventLog.recordPhase(BOOTSTRAP_PHASE_NAMES.COMPLETE, frozen.runId, {
      durationMs: this._lastDurationMs,
      openingChecksum,
    });

    return result;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ML / DL EXTRACTION
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Extract the 32-dim ML vector from the last bootstrap result.
   * Returns null if bootstrap has not yet been called.
   */
  public extractMLVector(): BootstrapMLVector | null {
    if (this._lastResult == null) return null;
    return extractBootstrapMLVector(this._lastResult, this._lastDurationMs, {
      modeOptionsApplied: this._lastModeOptionsApplied,
      cardRegistryValid: this._lastCardRegistryValid,
    });
  }

  /**
   * Build the 6×6 DL tensor from the last bootstrap result.
   * Returns null if bootstrap has not yet been called.
   */
  public buildDLTensor(): BootstrapDLTensor | null {
    if (this._lastResult == null) return null;
    return buildBootstrapDLTensor(this._lastResult, this.now());
  }

  /**
   * Build the BootstrapChatSignal from the last bootstrap result.
   * Returns null if bootstrap has not yet been called.
   */
  public buildChatSignal(): BootstrapChatSignal | null {
    if (this._lastResult == null) return null;
    return this._annotator.buildChatSignal(
      this._lastResult,
      this._lastDurationMs,
      {
        modeOptionsApplied: this._lastModeOptionsApplied,
        cardRegistryValid: this._lastCardRegistryValid,
      },
    );
  }

  /**
   * Build an annotation bundle from the last bootstrap result.
   */
  public buildAnnotation(): BootstrapAnnotationBundle | null {
    if (this._lastResult == null) return null;
    const health = computeBootstrapHealthScore(this._lastResult);
    const severity = classifyBootstrapSeverity(health);
    return this._annotator.buildAnnotation(this._lastResult, health, severity);
  }

  /**
   * Build a narration hint from the last bootstrap result.
   */
  public buildNarrationHint(): BootstrapNarrationHint | null {
    if (this._lastResult == null) return null;
    const health = computeBootstrapHealthScore(this._lastResult);
    return this._annotator.buildNarrationHint(this._lastResult, health);
  }

  /**
   * Compute the health score for the last bootstrap result.
   */
  public computeHealthScore(): number | null {
    if (this._lastResult == null) return null;
    return computeBootstrapHealthScore(this._lastResult);
  }

  /**
   * Get the last bootstrap result (null if never bootstrapped).
   */
  public getLastBootstrapResult(): RunBootstrapResult | null {
    return this._lastResult;
  }

  /**
   * Get the event log entries.
   */
  public getEventLog(): readonly BootstrapEventLogEntry[] {
    return this._eventLog.getAll();
  }

  /**
   * Build the tick-0 seal for the last bootstrap result.
   */
  public buildTickSeal(): string | null {
    if (this._lastResult == null) return null;
    return buildBootstrapTickSeal(
      this._lastResult.snapshot.runId,
      this._lastResult.snapshot.seed,
      this._lastResult.openingChecksum,
    );
  }

  /**
   * Build a health snapshot from the last bootstrap result.
   */
  public buildHealthSnapshot(
    registrySnapshot?: EngineRegistrySnapshot | null,
  ): BootstrapHealthSnapshot | null {
    if (this._lastResult == null) return null;
    const health = computeBootstrapHealthScore(this._lastResult);
    const severity = classifyBootstrapSeverity(health);
    const notes: string[] = [getBootstrapActionRecommendation(this._lastResult)];
    return Object.freeze({
      capturedAtMs: this.now(),
      severity,
      healthScore: health,
      isHealthy: severity === 'NOMINAL',
      registrySnapshot: registrySnapshot ?? null,
      notes: Object.freeze(notes),
    }) as BootstrapHealthSnapshot;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRIVATE METHODS (CORE LOGIC — UNCHANGED FROM ORIGINAL)
  // ─────────────────────────────────────────────────────────────────────────

  private normalizeInput(input: RunBootstrapInput): NormalizedBootstrapInput {
    const nowMs = this.now();
    const providedSeed = normalizeOptionalText(input.seed);
    const seed =
      providedSeed ??
      createDeterministicId(
        String(input.userId).trim(),
        String(input.mode).trim(),
        nowMs,
      );

    const providedRunId = normalizeOptionalText(input.runId);
    const runId = providedRunId ?? createDeterministicId(seed, 'run');

    return {
      factoryInput: {
        ...input,
        runId,
        seed,
      },
      modeOptions: input.modeOptions,
      preserveBusListeners: input.preserveBusListeners ?? true,
      preserveBusAnyListeners: input.preserveBusAnyListeners ?? true,
    };
  }

  private assertCanonicalIdentity(
    snapshot: RunStateSnapshot,
    input: RunFactoryInput,
  ): RunStateSnapshot {
    if (snapshot.runId !== input.runId) {
      throw new Error(
        `Run bootstrap produced a mismatched runId. Expected ${input.runId}, received ${snapshot.runId}.`,
      );
    }

    if (snapshot.userId !== input.userId) {
      throw new Error(
        `Run bootstrap produced a mismatched userId. Expected ${input.userId}, received ${snapshot.userId}.`,
      );
    }

    if (snapshot.seed !== input.seed) {
      throw new Error(
        `Run bootstrap produced a mismatched seed. Expected ${input.seed}, received ${snapshot.seed}.`,
      );
    }

    if (snapshot.mode !== input.mode) {
      throw new Error(
        `Run bootstrap produced a mismatched mode. Expected ${input.mode}, received ${snapshot.mode}.`,
      );
    }

    return snapshot;
  }

  private assertOpeningCards(snapshot: RunStateSnapshot): void {
    for (const instance of snapshot.cards.hand) {
      const definition = this.cardRegistry.require(instance.definitionId);

      if (definition.id !== instance.definitionId) {
        throw new Error(
          `Opening hand card definition mismatch for ${instance.instanceId}.`,
        );
      }

      if (instance.overlayAppliedForMode !== snapshot.mode) {
        throw new Error(
          `Opening hand card ${instance.definitionId} was overlaid for ${instance.overlayAppliedForMode} during ${snapshot.mode}.`,
        );
      }

      if (instance.card.id !== instance.definitionId) {
        throw new Error(
          `Opening hand card ${instance.instanceId} carries a mismatched embedded definition.`,
        );
      }
    }

    if (snapshot.tick !== 0) {
      throw new Error(
        `Run bootstrap must begin at tick 0. Received tick ${snapshot.tick}.`,
      );
    }

    if (snapshot.outcome !== null) {
      throw new Error(
        `Run bootstrap cannot start in a terminal state. Received outcome ${snapshot.outcome}.`,
      );
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FACTORY — createRunBootstrapPipelineWithAnalytics
// ─────────────────────────────────────────────────────────────────────────────

export interface RunBootstrapPipelineAnalyticsBundle {
  readonly pipeline: RunBootstrapPipeline;
  readonly sessionTracker: BootstrapSessionTracker;
  readonly trendAnalyzer: BootstrapTrendAnalyzer;
  readonly eventLog: BootstrapEventLog;
  readonly inspector: BootstrapInspector;
  readonly healthTracker: EngineRegistryHealthTracker;
  readonly sessionId: string;

  /** Run bootstrap and automatically record in session tracker + trend analyzer. */
  bootstrapAndRecord(
    input: RunBootstrapInput,
    opts?: { modeOptionsApplied?: boolean; cardRegistryValid?: boolean },
  ): RunBootstrapResult;

  /** Capture and build a full inspection bundle. */
  captureAndInspect(
    durationMs?: number,
    opts?: { modeOptionsApplied?: boolean; cardRegistryValid?: boolean },
  ): BootstrapInspectionBundle | null;

  /** Capture and build a full export bundle. */
  exportBundle(
    durationMs?: number,
    opts?: { modeOptionsApplied?: boolean; cardRegistryValid?: boolean },
  ): BootstrapExportBundle | null;

  /** Extract ML vector from the last result. */
  extractMLVector(): BootstrapMLVector | null;

  /** Build DL tensor from the last result. */
  buildDLTensor(): BootstrapDLTensor | null;

  /** Build chat signal from the last result. */
  buildChatSignal(): BootstrapChatSignal | null;

  /** Get current trend snapshot. */
  getTrend(): BootstrapTrendSnapshot;

  /** Get session report. */
  getSessionReport(): BootstrapSessionReport;
}

/**
 * Factory — createRunBootstrapPipelineWithAnalytics
 *
 * Wires RunBootstrapPipeline with BootstrapSessionTracker, BootstrapTrendAnalyzer,
 * BootstrapEventLog, BootstrapInspector, and EngineRegistryHealthTracker into a
 * single analytics bundle consumed by ZeroEngine and the Zero.* namespace.
 *
 * Usage:
 *   const bundle = createRunBootstrapPipelineWithAnalytics(deps);
 *   const result = bundle.bootstrapAndRecord({ userId: 'u1', mode: 'solo' });
 *   const mlVec  = bundle.extractMLVector();
 *   const tensor = bundle.buildDLTensor();
 *   const signal = bundle.buildChatSignal();
 *   const trend  = bundle.getTrend();
 *   const report = bundle.getSessionReport();
 *   const inspect = bundle.captureAndInspect();
 *   const export_ = bundle.exportBundle();
 */
export function createRunBootstrapPipelineWithAnalytics(
  deps: RunBootstrapPipelineDependencies,
): RunBootstrapPipelineAnalyticsBundle {
  const sessionId = createDeterministicId('bootstrap-session', String(Date.now()));
  const pipeline = new RunBootstrapPipeline(deps);
  const sessionTracker = new BootstrapSessionTracker(sessionId);
  const trendAnalyzer = new BootstrapTrendAnalyzer();
  const eventLog = new BootstrapEventLog();
  const inspector = new BootstrapInspector();
  const healthTracker = new EngineRegistryHealthTracker();

  const bootstrapAndRecord = (
    input: RunBootstrapInput,
    opts: { modeOptionsApplied?: boolean; cardRegistryValid?: boolean } = {},
  ): RunBootstrapResult => {
    const start = Date.now();
    let result: RunBootstrapResult;
    try {
      result = pipeline.bootstrap(input);
    } catch (err) {
      sessionTracker.recordFailure();
      throw err;
    }
    const durationMs = Date.now() - start;
    const healthScore = computeBootstrapHealthScore(result);
    const severity = classifyBootstrapSeverity(healthScore);

    sessionTracker.record(result, durationMs, opts);
    trendAnalyzer.addRecord(result, healthScore, severity);

    // Record phase log events from the pipeline's internal event log
    for (const entry of pipeline.getEventLog()) {
      eventLog.recordPhase(entry.phase, entry.runId, entry.data as Record<string, unknown>);
    }

    return result;
  };

  const captureAndInspect = (
    durationMs?: number,
    opts: { modeOptionsApplied?: boolean; cardRegistryValid?: boolean } = {},
  ): BootstrapInspectionBundle | null => {
    const lastResult = pipeline.getLastBootstrapResult();
    if (lastResult == null) return null;
    return inspector.buildInspectionBundle(lastResult, durationMs ?? 0, {
      sessionTracker,
      trendAnalyzer,
      eventLog,
      registrySnapshot: null,
      ...opts,
    });
  };

  const exportBundleFn = (
    durationMs?: number,
    opts: { modeOptionsApplied?: boolean; cardRegistryValid?: boolean } = {},
  ): BootstrapExportBundle | null => {
    const lastResult = pipeline.getLastBootstrapResult();
    if (lastResult == null) return null;
    return inspector.buildExportBundle(lastResult, durationMs ?? 0, sessionId, {
      sessionTracker,
      trendAnalyzer,
      eventLog,
      ...opts,
    });
  };

  return {
    pipeline,
    sessionTracker,
    trendAnalyzer,
    eventLog,
    inspector,
    healthTracker,
    sessionId,
    bootstrapAndRecord,
    captureAndInspect,
    exportBundle: exportBundleFn,
    extractMLVector: () => pipeline.extractMLVector(),
    buildDLTensor: () => pipeline.buildDLTensor(),
    buildChatSignal: () => pipeline.buildChatSignal(),
    getTrend: () => trendAnalyzer.getSnapshot(),
    getSessionReport: () => sessionTracker.getReport(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SINGLETONS & DEFAULT INSTANCES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Default zero-state ML vector (all features = 0).
 * Used as a safe initial value before first bootstrap.
 */
export const ZERO_DEFAULT_BOOTSTRAP_ML_VECTOR: BootstrapMLVector = deepFreeze({
  modeEncoded: 0,
  modeDifficultyMultiplier: 0,
  modeTensionFloor: 0,
  seedEntropyNormalized: 0,
  runIdEntropyNormalized: 0,
  handSizeNormalized: 0,
  drawPileSizeNormalized: 0,
  discardSizeNormalized: 0,
  exhaustSizeNormalized: 0,
  openingHandPowerNormalized: 0,
  openingHandTimingDiversity: 0,
  economyNetWorthNormalized: 0,
  economyCashNormalized: 0,
  economyDebtNormalized: 0,
  economyIncomeNormalized: 0,
  pressureTierEncoded: 0,
  pressureScoreNormalized: 0,
  tensionScoreNormalized: 0,
  shieldAvgIntegrity: 0,
  shieldWeakestLayerEncoded: 0,
  shieldL1Integrity: 0,
  shieldL4Integrity: 0,
  battleActiveBotCount: 0,
  battleNeutralizedBotCount: 0,
  botThreatScore: 0,
  cascadeActiveCount: 0,
  sovereigntyScoreNormalized: 0,
  integrityStatusRisk: 0,
  modeOptionsApplied: 0,
  cardRegistryValid: 0,
  checksumEntropyNormalized: 0,
  tickEncoded: 0,
  mlVectorArray: Object.freeze(Array(BOOTSTRAP_ML_FEATURE_COUNT).fill(0)),
}) as BootstrapMLVector;

/**
 * Default zero-state DL tensor (all features = 0).
 */
export const ZERO_DEFAULT_BOOTSTRAP_DL_TENSOR: BootstrapDLTensor = deepFreeze({
  rows: Object.freeze(
    BOOTSTRAP_DL_ROW_LABELS.map((domain, rowIndex) => ({
      domain,
      rowIndex,
      features: Object.freeze(Array(6).fill(0)),
      featureNames: Object.freeze(BOOTSTRAP_DL_COL_LABELS.slice()),
    })),
  ),
  shape: BOOTSTRAP_DL_TENSOR_SHAPE,
  domainOrder: BOOTSTRAP_DL_ROW_LABELS,
  capturedAtMs: 0,
  runId: '',
  mode: 'solo' as ModeCode,
}) as BootstrapDLTensor;

/**
 * Default zero-state chat signal.
 */
export const ZERO_DEFAULT_BOOTSTRAP_CHAT_SIGNAL: BootstrapChatSignal = deepFreeze({
  generatedAtMs: 0,
  severity: 'NOMINAL' as BootstrapSeverity,
  runId: '',
  userId: '',
  mode: 'solo' as ModeCode,
  phase: 'FOUNDATION' as RunPhase,
  seed: '',
  tick: 0,
  openingChecksum: '',
  handSize: 0,
  drawPileSize: 0,
  pressureTier: 'T0' as PressureTier,
  pressureBand: 'CALM' as PressureBand,
  integrityStatus: 'PENDING' as IntegrityStatus,
  sovereigntyScore: 0,
  modeOptionsApplied: false,
  cardRegistryValid: false,
  bootstrapDurationMs: 0,
  notes: Object.freeze([]),
  narrationHint: BOOTSTRAP_MODE_NARRATION['solo'],
  mlHealthScore: 0,
}) as BootstrapChatSignal;

/**
 * Singleton ML extractor — stateless function reference exposed under Zero.*.
 */
export const ZERO_BOOTSTRAP_ML_EXTRACTOR = extractBootstrapMLVector;

/**
 * Singleton DL builder — stateless function reference exposed under Zero.*.
 */
export const ZERO_BOOTSTRAP_DL_BUILDER = buildBootstrapDLTensor;

/**
 * Singleton annotator — exposed under Zero.*.
 */
export const ZERO_BOOTSTRAP_ANNOTATOR = new BootstrapAnnotator();

/**
 * Singleton inspector — exposed under Zero.*.
 */
export const ZERO_BOOTSTRAP_INSPECTOR = new BootstrapInspector();

/**
 * Singleton trend analyzer — exposed under Zero.* for session-level tracking.
 */
export const ZERO_BOOTSTRAP_TREND_ANALYZER = new BootstrapTrendAnalyzer();

// ─────────────────────────────────────────────────────────────────────────────
// RE-EXPORT VALIDATION GUARDS (MODE, OUTCOME, PRESSURE)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Type guard: is the given value a known canonical ModeCode?
 * Exposed for downstream consumers (e.g., chat adapters, orchestrators).
 */
export function isBootstrapModeCode(value: unknown): value is ModeCode {
  return isKnownMode(value);
}

/**
 * Type guard: is the given value a known canonical RunOutcome?
 */
export function isBootstrapRunOutcome(value: unknown): value is RunOutcome {
  return isKnownRunOutcome(value);
}

/**
 * Type guard: is the given value a known canonical PressureTier?
 */
export function isBootstrapPressureTier(value: unknown): value is PressureTier {
  return isKnownPressureTier(value);
}

/**
 * Type guard: is the given value a known canonical ShieldLayerId?
 */
export function isBootstrapShieldLayerId(value: unknown): value is ShieldLayerId {
  return isKnownShieldLayerId(value);
}

/**
 * Type guard: is the given value a known canonical HaterBotId?
 */
export function isBootstrapHaterBotId(value: unknown): value is HaterBotId {
  return isKnownBotId(value);
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE SEAL
// ─────────────────────────────────────────────────────────────────────────────

export const BOOTSTRAP_COMPLETE = true as const;
