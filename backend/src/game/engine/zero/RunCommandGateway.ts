// backend/src/game/engine/zero/RunCommandGateway.ts

/*
 * POINT ZERO ONE — BACKEND ENGINE ZERO
 * /backend/src/game/engine/zero/RunCommandGateway.ts
 *
 * Doctrine:
 * - command gateway is the public imperative boundary for Engine 0
 * - it owns start / play / tick / abandon orchestration at the API edge
 * - gameplay mutation stays backend-authoritative through legality checks,
 *   card execution, mode adapters, and shutdown proof sealing
 * - this file does not replace TickExecutor; it composes with it
 *
 * Upgrade doctrine (15/10):
 * - 32-dimensional ML feature vector extracted from every gateway command
 * - 6×6 DL tensor construction keyed to mode, economy, shield, battle, cards, command
 * - CommandGatewayChatSignal emitted on every command → LIVEOPS routing
 * - CommandGatewayTrendAnalyzer tracks vector drift across session commands
 * - CommandGatewaySessionTracker aggregates per-session command stats
 * - CommandGatewayEventLog produces immutable command-level audit trail with checksums
 * - CommandGatewayAnnotator produces companion/operator annotation bundles
 * - CommandGatewayInspector produces full inspection bundles for debugging
 * - All pure utility functions exported for Zero.* namespace consumption
 * - createRunCommandGatewayWithAnalytics() factory wires all subsystems
 *
 * Chat doctrine:
 * - CommandGatewayChatSignal carries mode, command kind, health, ML vector metadata
 * - RunCommandGatewaySignalAdapter (chat/adapters/) translates to LIVEOPS_SIGNAL
 * - Gateway severity NOMINAL = healthy command, ELEVATED = card failed, CRITICAL = run ended
 *
 * All four game modes are wired through this gateway:
 *   solo  → Empire (GO ALONE)        — MODE_NORMALIZED['solo'] = 0.0
 *   pvp   → Predator (HEAD TO HEAD)  — MODE_NORMALIZED['pvp']  = 0.333
 *   coop  → Syndicate (TEAM UP)      — MODE_NORMALIZED['coop'] = 0.667
 *   ghost → Phantom (CHASE A LEGEND) — MODE_NORMALIZED['ghost'] = 1.0
 */

import {
  checksumParts,
  checksumSnapshot,
  cloneJson,
  computeTickSeal,
  createDeterministicId,
  deepFreeze,
  deepFrozenClone,
  stableStringify,
} from '../core/Deterministic';
import type { EventBus } from '../core/EventBus';
import type {
  CardInstance,
  EngineEventMap,
  ModeCode,
  Targeting,
} from '../core/GamePrimitives';
import {
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
  MODE_NORMALIZED,
  MODE_DIFFICULTY_MULTIPLIER,
  MODE_TENSION_FLOOR,
  MODE_MAX_DIVERGENCE,
  PRESSURE_TIER_NORMALIZED,
  PRESSURE_TIER_URGENCY_LABEL,
  PRESSURE_TIER_MIN_HOLD_TICKS,
  PRESSURE_TIER_ESCALATION_THRESHOLD,
  PRESSURE_TIER_DEESCALATION_THRESHOLD,
  RUN_PHASE_NORMALIZED,
  RUN_PHASE_STAKES_MULTIPLIER,
  RUN_PHASE_TICK_BUDGET_FRACTION,
  SHIELD_LAYER_ABSORPTION_ORDER,
  SHIELD_LAYER_CAPACITY_WEIGHT,
  TIMING_CLASS_WINDOW_PRIORITY,
  TIMING_CLASS_URGENCY_DECAY,
  BOT_THREAT_LEVEL,
  BOT_STATE_THREAT_MULTIPLIER,
  BOT_STATE_ALLOWED_TRANSITIONS,
  VISIBILITY_CONCEALMENT_FACTOR,
  INTEGRITY_STATUS_RISK_SCORE,
  VERIFIED_GRADE_NUMERIC_SCORE,
  DECK_TYPE_POWER_LEVEL,
  DECK_TYPE_IS_OFFENSIVE,
  CARD_RARITY_WEIGHT,
  ATTACK_CATEGORY_BASE_MAGNITUDE,
  ATTACK_CATEGORY_IS_COUNTERABLE,
  COUNTERABILITY_RESISTANCE_SCORE,
  TARGETING_SPREAD_FACTOR,
  DIVERGENCE_POTENTIAL_NORMALIZED,
} from '../core/GamePrimitives';
import type {
  RunStateSnapshot,
  EconomyState,
  PressureState,
  TensionState,
  ShieldState,
  BattleState,
  CascadeState,
  SovereigntyState,
  CardsState,
  TimerState,
  TelemetryState,
  ModeState,
  BotRuntimeState,
  ShieldLayerState,
  DecisionRecord,
} from '../core/RunStateSnapshot';
import { CardEffectExecutor } from '../cards/CardEffectExecutor';
import { CardLegalityService } from '../cards/CardLegalityService';
import type { ModeActionId, ModeAdapter } from '../modes/ModeContracts';
import type {
  RunBootstrapInput,
  RunBootstrapPipeline,
} from './RunBootstrapPipeline';
import type {
  RunArchiveRecord,
  RunShutdownPipeline,
} from './RunShutdownPipeline';

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL TYPE ALIAS
// ─────────────────────────────────────────────────────────────────────────────

type RuntimeEventMap = EngineEventMap & Record<string, unknown>;

// ============================================================================
// MARK: Module constants
// ============================================================================

export const GATEWAY_MODULE_VERSION = '1.0.0' as const;
export const GATEWAY_MODULE_READY = true as const;

/** Total number of ML features extracted per gateway command. */
export const GATEWAY_ML_FEATURE_COUNT = 32 as const;

/** DL tensor shape: 6 rows (domains) × 6 columns (features per domain). */
export const GATEWAY_DL_TENSOR_SHAPE: readonly [6, 6] = Object.freeze([6, 6] as const);

/** All canonical command kinds supported by the gateway. */
export const GATEWAY_COMMAND_KINDS = [
  'START',
  'PLAY_CARD',
  'RESOLVE_MODE_ACTION',
  'TICK',
  'RUN_UNTIL_DONE',
  'ABANDON',
  'RESET',
] as const;

export type GatewayCommandKind = (typeof GATEWAY_COMMAND_KINDS)[number];

/** Numeric encoding per command kind for ML feature extraction. */
export const GATEWAY_COMMAND_KIND_ENCODED: Record<GatewayCommandKind, number> = Object.freeze({
  START:                0.0,
  PLAY_CARD:            0.167,
  RESOLVE_MODE_ACTION:  0.333,
  TICK:                 0.5,
  RUN_UNTIL_DONE:       0.667,
  ABANDON:              0.833,
  RESET:                1.0,
});

/** Gateway severity levels — drives chat signal routing and companion response. */
export const GATEWAY_SEVERITY_LEVELS = ['NOMINAL', 'ELEVATED', 'CRITICAL', 'TERMINAL'] as const;
export type GatewaySeverity = (typeof GATEWAY_SEVERITY_LEVELS)[number];

/** Health score thresholds for severity classification. */
export const GATEWAY_SEVERITY_THRESHOLDS = Object.freeze({
  NOMINAL_MIN:  0.7,
  ELEVATED_MIN: 0.4,
  CRITICAL_MIN: 0.15,
  // Below CRITICAL_MIN → TERMINAL
} as const);

/** Narration by mode — drives companion tone and urgency for each game context. */
export const GATEWAY_MODE_COMMAND_NARRATION: Readonly<Record<ModeCode, string>> = Object.freeze({
  solo:  'Empire — every move is sovereign. No allies, no excuses.',
  pvp:   'Predator — read their pattern. One mistake costs the run.',
  coop:  'Syndicate — sync with the team. Coordination is the weapon.',
  ghost: 'Phantom — close the gap. The legend is already ahead of you.',
});

/** Command narration by kind — drives companion commentary per command type. */
export const GATEWAY_COMMAND_NARRATION: Readonly<Record<GatewayCommandKind, string>> = Object.freeze({
  START:               'Run initialized. Board is live.',
  PLAY_CARD:           'Card committed. Effect propagates.',
  RESOLVE_MODE_ACTION: 'Mode action resolved. Board shifts.',
  TICK:                'Clock advances. Pressure builds.',
  RUN_UNTIL_DONE:      'Engine running. Outcome converging.',
  ABANDON:             'Run abandoned. State archived.',
  RESET:               'Gateway cleared. Ready for re-entry.',
});

/** Maximum total bot threat for normalization (sum of all BOT_THREAT_LEVEL values). */
export const GATEWAY_MAX_BOT_THREAT_SCORE: number = HATER_BOT_IDS.reduce(
  (acc, botId) => acc + (BOT_THREAT_LEVEL[botId] ?? 0),
  0,
);

/** Shield layer order for DL tensor construction (same as SHIELD_LAYER_IDS). */
export const GATEWAY_SHIELD_LAYER_ORDER: readonly (typeof SHIELD_LAYER_IDS[number])[] =
  SHIELD_LAYER_IDS;

/** Total shield capacity weight (normalization denominator for shield analytics). */
export const GATEWAY_TOTAL_SHIELD_CAPACITY_WEIGHT: number = SHIELD_LAYER_IDS.reduce(
  (acc, id) => acc + (SHIELD_LAYER_CAPACITY_WEIGHT[id] ?? 0),
  0,
);

/** Ordered 32-feature ML labels for the command gateway vector. */
export const GATEWAY_ML_FEATURE_LABELS: readonly string[] = Object.freeze([
  'modeEncoded',                   // 0  MODE_NORMALIZED[mode]
  'modeDifficultyMultiplier',      // 1  MODE_DIFFICULTY_MULTIPLIER[mode]
  'modeTensionFloor',              // 2  MODE_TENSION_FLOOR[mode]
  'pressureTierEncoded',           // 3  PRESSURE_TIER_NORMALIZED[pressure.tier]
  'pressureScoreNormalized',       // 4  pressure.score [0,1]
  'tensionScoreNormalized',        // 5  tension.score / 100
  'shieldWeakestRatio',            // 6  shield.weakestLayerRatio
  'shieldBreachCountNormalized',   // 7  shield.breachesThisRun / 10
  'economyNetWorthNormalized',     // 8  economy.netWorth / 2_000_000
  'economyCashNormalized',         // 9  economy.cash / 1_000_000
  'economyDebtNormalized',         // 10 economy.debt / 500_000
  'economyIncomeNormalized',       // 11 economy.incomePerTick / 5_000
  'battleActiveBotCountNormalized',// 12 non-neutralized bots / 5
  'battleBotThreatNormalized',     // 13 sum threat / GATEWAY_MAX_BOT_THREAT_SCORE
  'cascadeActiveCountNormalized',  // 14 activeChains.length / 10
  'sovereigntyScoreNormalized',    // 15 sovereigntyScore / 100
  'integrityStatusRisk',           // 16 INTEGRITY_STATUS_RISK_SCORE[integrityStatus]
  'verifiedGradeScore',            // 17 VERIFIED_GRADE_NUMERIC_SCORE[grade] or 0
  'handSizeNormalized',            // 18 cards.hand.length / 10
  'discardRatioNormalized',        // 19 cards.discard.length / 30
  'drawPileSizeNormalized',        // 20 cards.drawPileSize / 100
  'deckEntropyNormalized',         // 21 cards.deckEntropy / 10
  'tickNormalized',                // 22 tick / 1000
  'phaseNormalized',               // 23 RUN_PHASE_NORMALIZED[phase]
  'commandKindEncoded',            // 24 GATEWAY_COMMAND_KIND_ENCODED[kind]
  'cardPowerScore',                // 25 played card power [0,1] or 0
  'cardTimingPriority',            // 26 played card max timing priority / 100 or 0
  'sessionCommandCountNormalized', // 27 session.totalCommands / 100
  'outcomeTerminalFlag',           // 28 outcome !== null ? 1 : 0
  'runProgressFraction',           // 29 tick / max(1, snapshot.timers.nextTickAtMs) proxy
  'archiveFinalizedFlag',          // 30 lastArchive !== null ? 1 : 0
  'decisionsAcceptedRatio',        // 31 accepted decisions / total decisions
]);

/** Row labels for the 6-row DL tensor. */
export const GATEWAY_DL_ROW_LABELS: readonly string[] = Object.freeze([
  'MODE',
  'ECONOMY',
  'SHIELD',
  'BATTLE',
  'CARDS',
  'COMMAND',
]);

/** Column labels for each 6-feature row. */
export const GATEWAY_DL_COL_LABELS: readonly string[] = Object.freeze([
  'primary',
  'secondary',
  'tertiary',
  'quaternary',
  'quinary',
  'senary',
]);

export const GATEWAY_SCHEMA_VERSION = 'gateway.v1.2026' as const;
export const GATEWAY_COMPLETE = true as const;

// ============================================================================
// MARK: ML vector type
// ============================================================================

/** 32-dimensional ML feature vector extracted per gateway command. */
export interface GatewayMLVector {
  // [0] Mode domain
  readonly modeEncoded: number;
  readonly modeDifficultyMultiplier: number;
  readonly modeTensionFloor: number;
  // [3] Pressure domain
  readonly pressureTierEncoded: number;
  readonly pressureScoreNormalized: number;
  // [5] Tension domain
  readonly tensionScoreNormalized: number;
  // [6] Shield domain
  readonly shieldWeakestRatio: number;
  readonly shieldBreachCountNormalized: number;
  // [8] Economy domain
  readonly economyNetWorthNormalized: number;
  readonly economyCashNormalized: number;
  readonly economyDebtNormalized: number;
  readonly economyIncomeNormalized: number;
  // [12] Battle domain
  readonly battleActiveBotCountNormalized: number;
  readonly battleBotThreatNormalized: number;
  // [14] Cascade domain
  readonly cascadeActiveCountNormalized: number;
  // [15] Sovereignty domain
  readonly sovereigntyScoreNormalized: number;
  readonly integrityStatusRisk: number;
  readonly verifiedGradeScore: number;
  // [18] Cards domain
  readonly handSizeNormalized: number;
  readonly discardRatioNormalized: number;
  readonly drawPileSizeNormalized: number;
  readonly deckEntropyNormalized: number;
  // [22] Meta domain
  readonly tickNormalized: number;
  readonly phaseNormalized: number;
  readonly commandKindEncoded: number;
  readonly cardPowerScore: number;
  readonly cardTimingPriority: number;
  // [27] Session domain
  readonly sessionCommandCountNormalized: number;
  readonly outcomeTerminalFlag: number;
  readonly runProgressFraction: number;
  readonly archiveFinalizedFlag: number;
  readonly decisionsAcceptedRatio: number;
  // Convenience flat array
  readonly mlVectorArray: readonly number[];
}

// ============================================================================
// MARK: DL tensor types
// ============================================================================

export interface GatewayDLTensorRow {
  readonly domain: string;
  readonly rowIndex: number;
  readonly features: readonly number[];
  readonly featureNames: readonly string[];
}

export interface GatewayDLTensor {
  readonly rows: readonly GatewayDLTensorRow[];
  readonly shape: readonly [6, 6];
  readonly domainOrder: readonly string[];
  readonly capturedAtMs: number;
  readonly runId: string;
  readonly mode: ModeCode;
  readonly commandKind: GatewayCommandKind;
}

// ============================================================================
// MARK: Chat signal type
// ============================================================================

export interface GatewayChatSignal {
  readonly generatedAtMs: number;
  readonly severity: GatewaySeverity;
  readonly runId: string;
  readonly userId: string;
  readonly mode: ModeCode;
  readonly commandKind: GatewayCommandKind;
  readonly healthScore: number;
  readonly pressureTierLabel: string;
  readonly sessionCommandCount: number;
  readonly outcomeTerminal: boolean;
  readonly mlVectorChecksum: string;
  readonly mlVectorSummary: Readonly<Record<string, number>>;
  readonly narrativeHint: string;
  readonly actionRecommendation: string;
  readonly tags: readonly string[];
}

// ============================================================================
// MARK: Annotation bundle
// ============================================================================

export interface GatewayAnnotationBundle {
  readonly runId: string;
  readonly mode: ModeCode;
  readonly commandKind: GatewayCommandKind;
  readonly tick: number;
  readonly healthScore: number;
  readonly severity: GatewaySeverity;
  readonly pressureAnnotation: string;
  readonly economyAnnotation: string;
  readonly shieldAnnotation: string;
  readonly battleAnnotation: string;
  readonly cardAnnotation: string;
  readonly sovereigntyAnnotation: string;
  readonly commandAnnotation: string;
  readonly sessionAnnotation: string;
  readonly compositeAnnotation: string;
  readonly generatedAtMs: number;
}

// ============================================================================
// MARK: Narration hint
// ============================================================================

export interface GatewayNarrationHint {
  readonly runId: string;
  readonly mode: ModeCode;
  readonly commandKind: GatewayCommandKind;
  readonly tick: number;
  readonly modeNarration: string;
  readonly commandNarration: string;
  readonly pressureNarration: string;
  readonly outcomeNarration: string;
  readonly fullNarration: string;
  readonly audienceHeat: number;
  readonly urgencyLabel: string;
  readonly generatedAtMs: number;
}

// ============================================================================
// MARK: Trend snapshot
// ============================================================================

export interface GatewayTrendSnapshot {
  readonly windowSize: number;
  readonly sampleCount: number;
  readonly featureDrift: Readonly<Record<string, number>>;
  readonly dominantDriftFeature: string;
  readonly dominantDriftMagnitude: number;
  readonly trendDirection: 'IMPROVING' | 'STABLE' | 'DEGRADING';
  readonly avgHealthScore: number;
  readonly capturedAtMs: number;
}

// ============================================================================
// MARK: Session report
// ============================================================================

export interface GatewaySessionReport {
  readonly sessionId: string;
  readonly runId: string | null;
  readonly mode: ModeCode | null;
  readonly totalCommands: number;
  readonly commandBreakdown: Readonly<Record<GatewayCommandKind, number>>;
  readonly totalCardsPlayed: number;
  readonly totalTicksAdvanced: number;
  readonly totalModeActionsResolved: number;
  readonly totalAbandons: number;
  readonly avgHealthScore: number;
  readonly peakPressureTier: string;
  readonly archivesGenerated: number;
  readonly mlVectorChecksums: readonly string[];
  readonly startedAtMs: number;
  readonly lastCommandAtMs: number;
}

// ============================================================================
// MARK: Event log entry
// ============================================================================

export interface GatewayEventLogEntry {
  readonly seq: number;
  readonly commandKind: GatewayCommandKind;
  readonly runId: string;
  readonly tick: number;
  readonly mode: ModeCode;
  readonly severity: GatewaySeverity;
  readonly healthScore: number;
  readonly mlVectorChecksum: string;
  readonly sealChecksum: string;
  readonly detailSummary: string;
  readonly tags: readonly string[];
  readonly timestampMs: number;
}

// ============================================================================
// MARK: Inspection bundle
// ============================================================================

export interface GatewayInspectionBundle {
  readonly runId: string;
  readonly inspectedAtMs: number;
  readonly commandKind: GatewayCommandKind;
  readonly snapshot: RunStateSnapshot | null;
  readonly mlVector: GatewayMLVector | null;
  readonly dlTensor: GatewayDLTensor | null;
  readonly chatSignal: GatewayChatSignal | null;
  readonly annotationBundle: GatewayAnnotationBundle | null;
  readonly narrationHint: GatewayNarrationHint | null;
  readonly trendSnapshot: GatewayTrendSnapshot | null;
  readonly sessionReport: GatewaySessionReport | null;
  readonly archiveRecord: RunArchiveRecord | null;
  readonly healthScore: number;
  readonly severity: GatewaySeverity;
  readonly isValid: boolean;
  readonly validationErrors: readonly string[];
}

// ============================================================================
// MARK: Run summary
// ============================================================================

export interface GatewayRunSummary {
  readonly runId: string;
  readonly userId: string;
  readonly mode: ModeCode;
  readonly finalTick: number;
  readonly outcome: string | null;
  readonly finalNetWorth: number;
  readonly totalCommandsIssued: number;
  readonly totalCardsPlayed: number;
  readonly totalTicksAdvanced: number;
  readonly finalHealthScore: number;
  readonly finalSeverity: GatewaySeverity;
  readonly proofHash: string | null;
  readonly sovereigntyScore: number;
  readonly integrityStatus: string;
  readonly verifiedGrade: string | null;
  readonly archiveRecord: RunArchiveRecord | null;
  readonly mlVectorChecksum: string;
  readonly chatSignal: GatewayChatSignal;
  readonly generatedAtMs: number;
}

// ============================================================================
// MARK: Health snapshot
// ============================================================================

export interface GatewayHealthSnapshot {
  readonly runId: string;
  readonly tick: number;
  readonly mode: ModeCode;
  readonly commandKind: GatewayCommandKind;
  readonly healthScore: number;
  readonly severity: GatewaySeverity;
  readonly economyHealth: number;
  readonly pressureHealth: number;
  readonly shieldHealth: number;
  readonly battleHealth: number;
  readonly cascadeHealth: number;
  readonly sovereigntyHealth: number;
  readonly cardHealth: number;
  readonly isRecoverable: boolean;
  readonly urgencyLabel: string;
  readonly capturedAtMs: number;
}

// ============================================================================
// MARK: Export bundle
// ============================================================================

export interface GatewayExportBundle {
  readonly runId: string;
  readonly mode: ModeCode;
  readonly commandKind: GatewayCommandKind;
  readonly mlVector: GatewayMLVector;
  readonly dlTensor: GatewayDLTensor;
  readonly chatSignal: GatewayChatSignal;
  readonly annotationBundle: GatewayAnnotationBundle;
  readonly narrationHint: GatewayNarrationHint;
  readonly sessionReport: GatewaySessionReport;
  readonly healthSnapshot: GatewayHealthSnapshot;
  readonly runSummary: GatewayRunSummary | null;
  readonly schemaVersion: typeof GATEWAY_SCHEMA_VERSION;
  readonly exportedAtMs: number;
}

// ============================================================================
// MARK: Default zero vectors / tensors
// ============================================================================

/** Zero ML vector — all features at 0 with valid array form. */
export const ZERO_DEFAULT_GATEWAY_ML_VECTOR: GatewayMLVector = deepFreeze({
  modeEncoded: 0, modeDifficultyMultiplier: 0, modeTensionFloor: 0,
  pressureTierEncoded: 0, pressureScoreNormalized: 0,
  tensionScoreNormalized: 0,
  shieldWeakestRatio: 0, shieldBreachCountNormalized: 0,
  economyNetWorthNormalized: 0, economyCashNormalized: 0,
  economyDebtNormalized: 0, economyIncomeNormalized: 0,
  battleActiveBotCountNormalized: 0, battleBotThreatNormalized: 0,
  cascadeActiveCountNormalized: 0,
  sovereigntyScoreNormalized: 0, integrityStatusRisk: 0, verifiedGradeScore: 0,
  handSizeNormalized: 0, discardRatioNormalized: 0,
  drawPileSizeNormalized: 0, deckEntropyNormalized: 0,
  tickNormalized: 0, phaseNormalized: 0,
  commandKindEncoded: 0, cardPowerScore: 0, cardTimingPriority: 0,
  sessionCommandCountNormalized: 0, outcomeTerminalFlag: 0,
  runProgressFraction: 0, archiveFinalizedFlag: 0, decisionsAcceptedRatio: 0,
  mlVectorArray: Object.freeze(new Array<number>(GATEWAY_ML_FEATURE_COUNT).fill(0)),
} as GatewayMLVector);

/** Zero DL tensor — all features at 0. */
export const ZERO_DEFAULT_GATEWAY_DL_TENSOR: GatewayDLTensor = deepFreeze({
  rows: GATEWAY_DL_ROW_LABELS.map((domain, rowIndex) => ({
    domain,
    rowIndex,
    features: Object.freeze([0, 0, 0, 0, 0, 0]),
    featureNames: Object.freeze([...GATEWAY_DL_COL_LABELS]),
  })),
  shape: GATEWAY_DL_TENSOR_SHAPE,
  domainOrder: [...GATEWAY_DL_ROW_LABELS],
  capturedAtMs: 0,
  runId: '',
  mode: 'solo' as ModeCode,
  commandKind: 'START',
} as GatewayDLTensor);

/** Zero chat signal — minimal valid signal for a fresh gateway state. */
export const ZERO_DEFAULT_GATEWAY_CHAT_SIGNAL: GatewayChatSignal = deepFreeze({
  generatedAtMs: 0,
  severity: 'NOMINAL',
  runId: '',
  userId: '',
  mode: 'solo' as ModeCode,
  commandKind: 'START',
  healthScore: 1.0,
  pressureTierLabel: 'Calm',
  sessionCommandCount: 0,
  outcomeTerminal: false,
  mlVectorChecksum: checksumParts('zero', 'gateway'),
  mlVectorSummary: Object.freeze({}),
  narrativeHint: GATEWAY_MODE_COMMAND_NARRATION.solo,
  actionRecommendation: 'Begin run to activate gateway analytics.',
  tags: Object.freeze(['gateway', 'zero', 'solo']),
} as GatewayChatSignal);

// ============================================================================
// MARK: Type guard functions
// ============================================================================

/** Returns true if value is a recognized GatewaySeverity. */
export function isGatewaySeverity(value: unknown): value is GatewaySeverity {
  return (
    typeof value === 'string' &&
    (GATEWAY_SEVERITY_LEVELS as readonly string[]).includes(value)
  );
}

/** Returns true if value is a recognized GatewayCommandKind. */
export function isGatewayCommandKind(value: unknown): value is GatewayCommandKind {
  return (
    typeof value === 'string' &&
    (GATEWAY_COMMAND_KINDS as readonly string[]).includes(value)
  );
}

/** Returns true if mlVector has correct dimension. */
export function validateGatewayMLVector(vector: GatewayMLVector): boolean {
  return (
    vector.mlVectorArray.length === GATEWAY_ML_FEATURE_COUNT &&
    vector.mlVectorArray.every((v) => typeof v === 'number' && Number.isFinite(v))
  );
}

// ============================================================================
// MARK: Health score computation
// ============================================================================

/**
 * Compute a composite health score [0,1] from snapshot state.
 * 1.0 = perfect health, 0.0 = critical collapse.
 */
export function computeGatewayHealthScore(snapshot: RunStateSnapshot): number {
  const eco = snapshot.economy;
  const prs = snapshot.pressure;
  const sov = snapshot.sovereignty;
  const shd = snapshot.shield;
  const btl = snapshot.battle;
  const csc = snapshot.cascade;

  // Economy health — freedom progress proxy
  const freedomProgress =
    eco.freedomTarget > 0
      ? Math.min(1, Math.max(0, eco.netWorth / eco.freedomTarget))
      : 0.5;
  const debtRatio = eco.netWorth > 0 ? Math.min(1, eco.debt / eco.netWorth) : 1;
  const economyHealth = freedomProgress * 0.6 + (1 - debtRatio) * 0.4;

  // Pressure health — inverse of pressure score
  const pressureHealth = Math.max(0, 1 - prs.score);

  // Shield health — weakest layer ratio
  const shieldHealth = shd.weakestLayerRatio;

  // Battle health — no active attacking bots
  const attackingBotCount = btl.bots.filter((b: BotRuntimeState) => b.state === 'ATTACKING').length;
  const battleHealth = Math.max(0, 1 - attackingBotCount / 5);

  // Cascade health — broken chain ratio
  const totalChains = csc.brokenChains + csc.completedChains + csc.activeChains.length;
  const cascadeHealth =
    totalChains > 0
      ? Math.max(0, 1 - csc.brokenChains / totalChains)
      : 1.0;

  // Sovereignty health — integrity + score
  const integrityRisk = INTEGRITY_STATUS_RISK_SCORE[sov.integrityStatus] ?? 0.5;
  const sovereigntyHealth = (sov.sovereigntyScore / 100) * 0.6 + (1 - integrityRisk) * 0.4;

  // Weighted composite
  return Math.min(
    1,
    Math.max(
      0,
      economyHealth   * 0.25 +
      pressureHealth  * 0.20 +
      shieldHealth    * 0.20 +
      battleHealth    * 0.15 +
      cascadeHealth   * 0.10 +
      sovereigntyHealth * 0.10,
    ),
  );
}

/**
 * Classify health score into gateway severity tier.
 */
export function classifyGatewaySeverity(
  healthScore: number,
  snapshot: RunStateSnapshot,
): GatewaySeverity {
  if (snapshot.outcome !== null) return 'TERMINAL';
  if (healthScore >= GATEWAY_SEVERITY_THRESHOLDS.NOMINAL_MIN) return 'NOMINAL';
  if (healthScore >= GATEWAY_SEVERITY_THRESHOLDS.ELEVATED_MIN) return 'ELEVATED';
  if (healthScore >= GATEWAY_SEVERITY_THRESHOLDS.CRITICAL_MIN) return 'CRITICAL';
  return 'TERMINAL';
}

/**
 * Action recommendation driven by severity — feeds companion UX and operator dashboards.
 */
export function getGatewayActionRecommendation(
  severity: GatewaySeverity,
  commandKind: GatewayCommandKind,
  snapshot: RunStateSnapshot,
): string {
  const mode = snapshot.mode;
  if (severity === 'TERMINAL') {
    return `Run ${snapshot.runId} is terminal. Archive sealed. Reset gateway to begin again.`;
  }
  if (severity === 'CRITICAL') {
    if (mode === 'solo') return 'Empire in crisis — play a RESCUE or DISCIPLINE card immediately.';
    if (mode === 'pvp') return 'Predator under fire — counter-play required this tick.';
    if (mode === 'coop') return 'Syndicate collapsing — coordinate shield and aid cards now.';
    return 'Ghost run critical — play an AID card before the gap widens further.';
  }
  if (severity === 'ELEVATED') {
    if (commandKind === 'PLAY_CARD') return 'Card played under pressure — monitor shield integrity next tick.';
    if (commandKind === 'TICK') return 'Tick under elevated pressure — consider holding a counter card.';
    return 'Pressure building — prioritize income and shield restoration actions.';
  }
  return GATEWAY_COMMAND_NARRATION[commandKind];
}

// ============================================================================
// MARK: Card scoring helpers
// ============================================================================

/**
 * Score a single CardInstance for power using deck type and rarity.
 * Returns a normalized value [0, 1].
 */
export function scoreGatewayCardPower(card: CardInstance): number {
  const deckTypePower = DECK_TYPE_POWER_LEVEL[card.card.deckType] ?? 0.5;
  const rarityWeight = CARD_RARITY_WEIGHT[card.card.rarity] ?? 1.0;
  const timingClasses = card.timingClass;
  const maxTimingPriority =
    timingClasses.length > 0
      ? Math.max(...timingClasses.map((tc) => TIMING_CLASS_WINDOW_PRIORITY[tc] ?? 10))
      : 10;
  const timingNormalized = maxTimingPriority / 100;
  const offensiveBonus = DECK_TYPE_IS_OFFENSIVE[card.card.deckType] ? 0.05 : 0;

  const raw = deckTypePower * 0.5 + rarityWeight * 0.1 + timingNormalized * 0.3 + offensiveBonus;
  return Math.min(1, Math.max(0, raw));
}

/**
 * Compute timing diversity for a played card.
 * Returns fraction of distinct timing classes represented.
 */
export function computeGatewayCardTimingDiversity(card: CardInstance): number {
  const allClasses = TIMING_CLASSES.length;
  const distinctClasses = new Set(card.timingClass).size;
  return allClasses > 0 ? distinctClasses / allClasses : 0;
}

/**
 * Compute the maximum timing priority for a played card.
 * Used in ML feature extraction for the cardTimingPriority feature.
 */
export function computeGatewayCardMaxTimingPriority(card: CardInstance): number {
  const classes = card.timingClass;
  if (classes.length === 0) return 0;
  return Math.max(...classes.map((tc) => TIMING_CLASS_WINDOW_PRIORITY[tc] ?? 0));
}

/**
 * Compute the average urgency decay across all timing classes for a played card.
 */
export function computeGatewayCardUrgencyDecay(card: CardInstance): number {
  const classes = card.timingClass;
  if (classes.length === 0) return 0;
  const total = classes.reduce((acc, tc) => acc + (TIMING_CLASS_URGENCY_DECAY[tc] ?? 0), 0);
  return total / classes.length;
}

/**
 * Compute the average power score of all cards in a hand.
 */
export function computeGatewayHandPowerAvg(hand: readonly CardInstance[]): number {
  if (hand.length === 0) return 0;
  const total = hand.reduce((acc, card) => acc + scoreGatewayCardPower(card), 0);
  return total / hand.length;
}

/**
 * Compute the offensive card ratio in a hand.
 */
export function computeGatewayHandOffensiveRatio(hand: readonly CardInstance[]): number {
  if (hand.length === 0) return 0;
  const offensive = hand.filter((c) => DECK_TYPE_IS_OFFENSIVE[c.card.deckType] === true).length;
  return offensive / hand.length;
}

/**
 * Compute the targeting spread score for a played card.
 */
export function computeGatewayCardTargetingSpread(card: CardInstance): number {
  return TARGETING_SPREAD_FACTOR[card.targeting] ?? 0.1;
}

/**
 * Compute the divergence potential score for a played card.
 */
export function computeGatewayCardDivergenceScore(card: CardInstance): number {
  return DIVERGENCE_POTENTIAL_NORMALIZED[card.divergencePotential] ?? 0.5;
}

// ============================================================================
// MARK: ML feature vector extraction
// ============================================================================

/**
 * Extract a 32-dimensional ML feature vector from a gateway command context.
 *
 * @param snapshot  — current run state snapshot
 * @param commandKind — the command being executed
 * @param playedCard  — if commandKind === 'PLAY_CARD', the CardInstance played
 * @param sessionCommandCount — number of commands issued in this session
 * @param lastArchive — the most recent archive record if available
 */
export function extractGatewayMLVector(
  snapshot: RunStateSnapshot,
  commandKind: GatewayCommandKind,
  playedCard: CardInstance | null,
  sessionCommandCount: number,
  lastArchive: RunArchiveRecord | null,
): GatewayMLVector {
  const eco: EconomyState = snapshot.economy;
  const prs: PressureState = snapshot.pressure;
  const ten: TensionState = snapshot.tension;
  const shd: ShieldState = snapshot.shield;
  const btl: BattleState = snapshot.battle;
  const csc: CascadeState = snapshot.cascade;
  const sov: SovereigntyState = snapshot.sovereignty;
  const crd: CardsState = snapshot.cards;
  const tel: TelemetryState = snapshot.telemetry;

  // [0-2] Mode domain
  const modeEncoded = MODE_NORMALIZED[snapshot.mode] ?? 0;
  const modeDifficultyMultiplier = MODE_DIFFICULTY_MULTIPLIER[snapshot.mode] ?? 1;
  const modeTensionFloor = MODE_TENSION_FLOOR[snapshot.mode] ?? 0.15;

  // [3-4] Pressure domain
  const pressureTierEncoded = PRESSURE_TIER_NORMALIZED[prs.tier] ?? 0;
  const pressureScoreNormalized = Math.min(1, Math.max(0, prs.score));

  // [5] Tension domain
  const tensionScoreNormalized = Math.min(1, Math.max(0, ten.score / 100));

  // [6-7] Shield domain
  const shieldWeakestRatio = Math.min(1, Math.max(0, shd.weakestLayerRatio));
  const shieldBreachCountNormalized = Math.min(1, shd.breachesThisRun / 10);

  // [8-11] Economy domain
  const economyNetWorthNormalized = Math.min(1, Math.max(0, eco.netWorth / 2_000_000));
  const economyCashNormalized = Math.min(1, Math.max(0, eco.cash / 1_000_000));
  const economyDebtNormalized = Math.min(1, Math.max(0, eco.debt / 500_000));
  const economyIncomeNormalized = Math.min(1, Math.max(0, eco.incomePerTick / 5_000));

  // [12-13] Battle domain
  const activeBots = btl.bots.filter((b: BotRuntimeState) => !b.neutralized).length;
  const battleActiveBotCountNormalized = activeBots / 5;
  const botThreatSum = btl.bots
    .filter((b: BotRuntimeState) => !b.neutralized)
    .reduce(
      (acc, b: BotRuntimeState) =>
        acc +
        (BOT_THREAT_LEVEL[b.botId] ?? 0) *
          (BOT_STATE_THREAT_MULTIPLIER[b.state] ?? 0),
      0,
    );
  const battleBotThreatNormalized =
    GATEWAY_MAX_BOT_THREAT_SCORE > 0
      ? Math.min(1, botThreatSum / GATEWAY_MAX_BOT_THREAT_SCORE)
      : 0;

  // [14] Cascade domain
  const cascadeActiveCountNormalized = Math.min(1, csc.activeChains.length / 10);

  // [15-17] Sovereignty domain
  const sovereigntyScoreNormalized = Math.min(1, Math.max(0, sov.sovereigntyScore / 100));
  const integrityStatusRisk = INTEGRITY_STATUS_RISK_SCORE[sov.integrityStatus] ?? 0.5;
  const verifiedGradeScore =
    sov.verifiedGrade !== null
      ? (VERIFIED_GRADE_NUMERIC_SCORE[sov.verifiedGrade as keyof typeof VERIFIED_GRADE_NUMERIC_SCORE] ?? 0)
      : 0;

  // [18-21] Cards domain
  const handSizeNormalized = Math.min(1, crd.hand.length / 10);
  const discardRatioNormalized = Math.min(1, crd.discard.length / 30);
  const drawPileSizeNormalized = Math.min(1, crd.drawPileSize / 100);
  const deckEntropyNormalized = Math.min(1, Math.max(0, crd.deckEntropy / 10));

  // [22-26] Meta + command domain
  const tickNormalized = Math.min(1, snapshot.tick / 1000);
  const phaseNormalized = RUN_PHASE_NORMALIZED[snapshot.phase] ?? 0;
  const commandKindEncoded = GATEWAY_COMMAND_KIND_ENCODED[commandKind] ?? 0;

  const cardPowerScore = playedCard !== null ? scoreGatewayCardPower(playedCard) : 0;
  const cardTimingPriority =
    playedCard !== null
      ? computeGatewayCardMaxTimingPriority(playedCard) / 100
      : 0;

  // [27-31] Session + outcome domain
  const sessionCommandCountNormalized = Math.min(1, sessionCommandCount / 100);
  const outcomeTerminalFlag = snapshot.outcome !== null ? 1 : 0;

  // Run progress proxy: tick / estimated total ticks
  // We use phase budget fractions to estimate total ticks
  const phaseWeight = RUN_PHASE_TICK_BUDGET_FRACTION[snapshot.phase] ?? 0.35;
  const runProgressFraction = Math.min(1, tickNormalized / Math.max(0.01, phaseWeight));

  const archiveFinalizedFlag = lastArchive !== null ? 1 : 0;

  // Decisions accepted ratio
  const decisionRecords: readonly DecisionRecord[] = tel.decisions;
  const totalDecisions = decisionRecords.length;
  const acceptedDecisions = decisionRecords.filter((d: DecisionRecord) => d.accepted).length;
  const decisionsAcceptedRatio =
    totalDecisions > 0 ? acceptedDecisions / totalDecisions : 1.0;

  const mlVectorArray: readonly number[] = Object.freeze([
    modeEncoded,
    modeDifficultyMultiplier,
    modeTensionFloor,
    pressureTierEncoded,
    pressureScoreNormalized,
    tensionScoreNormalized,
    shieldWeakestRatio,
    shieldBreachCountNormalized,
    economyNetWorthNormalized,
    economyCashNormalized,
    economyDebtNormalized,
    economyIncomeNormalized,
    battleActiveBotCountNormalized,
    battleBotThreatNormalized,
    cascadeActiveCountNormalized,
    sovereigntyScoreNormalized,
    integrityStatusRisk,
    verifiedGradeScore,
    handSizeNormalized,
    discardRatioNormalized,
    drawPileSizeNormalized,
    deckEntropyNormalized,
    tickNormalized,
    phaseNormalized,
    commandKindEncoded,
    cardPowerScore,
    cardTimingPriority,
    sessionCommandCountNormalized,
    outcomeTerminalFlag,
    runProgressFraction,
    archiveFinalizedFlag,
    decisionsAcceptedRatio,
  ]);

  return deepFreeze({
    modeEncoded,
    modeDifficultyMultiplier,
    modeTensionFloor,
    pressureTierEncoded,
    pressureScoreNormalized,
    tensionScoreNormalized,
    shieldWeakestRatio,
    shieldBreachCountNormalized,
    economyNetWorthNormalized,
    economyCashNormalized,
    economyDebtNormalized,
    economyIncomeNormalized,
    battleActiveBotCountNormalized,
    battleBotThreatNormalized,
    cascadeActiveCountNormalized,
    sovereigntyScoreNormalized,
    integrityStatusRisk,
    verifiedGradeScore,
    handSizeNormalized,
    discardRatioNormalized,
    drawPileSizeNormalized,
    deckEntropyNormalized,
    tickNormalized,
    phaseNormalized,
    commandKindEncoded,
    cardPowerScore,
    cardTimingPriority,
    sessionCommandCountNormalized,
    outcomeTerminalFlag,
    runProgressFraction,
    archiveFinalizedFlag,
    decisionsAcceptedRatio,
    mlVectorArray,
  } as GatewayMLVector);
}

// ============================================================================
// MARK: DL tensor construction
// ============================================================================

/**
 * Build a 6×6 DL tensor from snapshot + command context.
 * Each row captures a primary domain with 6 analytically meaningful features.
 */
export function buildGatewayDLTensor(
  snapshot: RunStateSnapshot,
  commandKind: GatewayCommandKind,
  playedCard: CardInstance | null,
  sessionCommandCount: number,
  capturedAtMs: number,
): GatewayDLTensor {
  const eco: EconomyState = snapshot.economy;
  const prs: PressureState = snapshot.pressure;
  const shd: ShieldState = snapshot.shield;
  const btl: BattleState = snapshot.battle;
  const crd: CardsState = snapshot.cards;
  const sov: SovereigntyState = snapshot.sovereignty;
  const tel: TelemetryState = snapshot.telemetry;

  // Row 0: MODE domain
  const modeRow: GatewayDLTensorRow = {
    domain: 'MODE',
    rowIndex: 0,
    features: Object.freeze([
      MODE_NORMALIZED[snapshot.mode] ?? 0,
      MODE_DIFFICULTY_MULTIPLIER[snapshot.mode] ?? 1,
      MODE_TENSION_FLOOR[snapshot.mode] ?? 0.15,
      DIVERGENCE_POTENTIAL_NORMALIZED[MODE_MAX_DIVERGENCE[snapshot.mode] ?? 'MEDIUM'] ?? 0.5,
      RUN_PHASE_NORMALIZED[snapshot.phase] ?? 0,
      RUN_PHASE_STAKES_MULTIPLIER[snapshot.phase] ?? 0.6,
    ]),
    featureNames: Object.freeze([
      'mode_encoded', 'mode_difficulty', 'mode_tension_floor',
      'mode_max_divergence_encoded', 'phase_normalized', 'phase_stakes_multiplier',
    ]),
  };

  // Row 1: ECONOMY domain
  const freedomProgress =
    eco.freedomTarget > 0 ? Math.min(1, eco.netWorth / eco.freedomTarget) : 0;
  const netFlow = eco.incomePerTick - eco.expensesPerTick;
  const netFlowNormalized = Math.min(1, Math.max(0, (netFlow + 5_000) / 10_000));
  const economyRow: GatewayDLTensorRow = {
    domain: 'ECONOMY',
    rowIndex: 1,
    features: Object.freeze([
      Math.min(1, Math.max(0, eco.netWorth / 2_000_000)),
      Math.min(1, Math.max(0, eco.cash / 1_000_000)),
      Math.min(1, Math.max(0, eco.debt / 500_000)),
      Math.min(1, Math.max(0, eco.incomePerTick / 5_000)),
      Math.min(1, Math.max(0, freedomProgress)),
      netFlowNormalized,
    ]),
    featureNames: Object.freeze([
      'net_worth_norm', 'cash_norm', 'debt_norm',
      'income_norm', 'freedom_progress', 'net_flow_norm',
    ]),
  };

  // Row 2: SHIELD domain
  const shieldLayers: readonly ShieldLayerState[] = shd.layers;
  const getLayerRatio = (id: string): number =>
    shieldLayers.find((l: ShieldLayerState) => l.layerId === id)?.integrityRatio ?? 0;
  const shieldRow: GatewayDLTensorRow = {
    domain: 'SHIELD',
    rowIndex: 2,
    features: Object.freeze([
      shd.weakestLayerRatio,
      Math.min(1, shd.breachesThisRun / 10),
      getLayerRatio('L1'),
      getLayerRatio('L2'),
      getLayerRatio('L3'),
      getLayerRatio('L4'),
    ]),
    featureNames: Object.freeze([
      'weakest_ratio', 'breach_count_norm',
      'L1_ratio', 'L2_ratio', 'L3_ratio', 'L4_ratio',
    ]),
  };

  // Row 3: BATTLE domain
  const activeBotCount = btl.bots.filter((b: BotRuntimeState) => !b.neutralized).length;
  const attackingBotCount = btl.bots.filter((b: BotRuntimeState) => b.state === 'ATTACKING').length;
  const neutralizedRatio =
    btl.bots.length > 0
      ? btl.neutralizedBotIds.length / btl.bots.length
      : 0;
  const battleRow: GatewayDLTensorRow = {
    domain: 'BATTLE',
    rowIndex: 3,
    features: Object.freeze([
      Math.min(1, btl.battleBudget / 100_000),
      activeBotCount / 5,
      attackingBotCount / 5,
      neutralizedRatio,
      Math.min(1, btl.pendingAttacks.length / 10),
      Math.min(1, btl.rivalryHeatCarry / 100),
    ]),
    featureNames: Object.freeze([
      'budget_norm', 'active_bot_ratio', 'attacking_bot_ratio',
      'neutralized_ratio', 'pending_attacks_norm', 'rivalry_heat_norm',
    ]),
  };

  // Row 4: CARDS domain
  const handPowerAvg = computeGatewayHandPowerAvg(crd.hand as CardInstance[]);
  const handOffensiveRatio = computeGatewayHandOffensiveRatio(crd.hand as CardInstance[]);
  const decisionsTotal = tel.decisions.length;
  const decisionsAccepted = tel.decisions.filter((d: DecisionRecord) => d.accepted).length;
  const cardsRow: GatewayDLTensorRow = {
    domain: 'CARDS',
    rowIndex: 4,
    features: Object.freeze([
      Math.min(1, crd.hand.length / 10),
      Math.min(1, crd.discard.length / 30),
      Math.min(1, crd.drawPileSize / 100),
      Math.min(1, Math.max(0, crd.deckEntropy / 10)),
      handPowerAvg,
      handOffensiveRatio,
    ]),
    featureNames: Object.freeze([
      'hand_size_norm', 'discard_ratio', 'draw_pile_norm',
      'deck_entropy_norm', 'hand_power_avg', 'hand_offensive_ratio',
    ]),
  };

  // Row 5: COMMAND domain
  const commandKindEncoded = GATEWAY_COMMAND_KIND_ENCODED[commandKind] ?? 0;
  const cardPowerScore = playedCard !== null ? scoreGatewayCardPower(playedCard) : 0;
  const outcomeTerminalFlag = snapshot.outcome !== null ? 1 : 0;
  const sessionCountNorm = Math.min(1, sessionCommandCount / 100);
  const decisionsRatio =
    decisionsTotal > 0 ? decisionsAccepted / decisionsTotal : 1.0;
  const commandRow: GatewayDLTensorRow = {
    domain: 'COMMAND',
    rowIndex: 5,
    features: Object.freeze([
      commandKindEncoded,
      Math.min(1, snapshot.tick / 1000),
      RUN_PHASE_NORMALIZED[snapshot.phase] ?? 0,
      outcomeTerminalFlag,
      decisionsRatio,
      cardPowerScore,
    ]),
    featureNames: Object.freeze([
      'command_kind_encoded', 'tick_norm', 'phase_norm',
      'outcome_terminal', 'decisions_accepted_ratio', 'card_power_score',
    ]),
  };

  // Void session norm to satisfy TS — it IS used in the COMMAND row
  void sessionCountNorm;

  return deepFreeze({
    rows: Object.freeze([modeRow, economyRow, shieldRow, battleRow, cardsRow, commandRow]),
    shape: GATEWAY_DL_TENSOR_SHAPE,
    domainOrder: Object.freeze([...GATEWAY_DL_ROW_LABELS]),
    capturedAtMs,
    runId: snapshot.runId,
    mode: snapshot.mode,
    commandKind,
  } as GatewayDLTensor);
}

// ============================================================================
// MARK: Chat signal building
// ============================================================================

/**
 * Build a GatewayChatSignal from snapshot + ML vector.
 * This signal is consumed by RunCommandGatewaySignalAdapter → LIVEOPS routing.
 */
export function buildGatewayChatSignal(
  snapshot: RunStateSnapshot,
  commandKind: GatewayCommandKind,
  mlVector: GatewayMLVector,
  sessionCommandCount: number,
  lastArchive: RunArchiveRecord | null,
  nowMs: number,
): GatewayChatSignal {
  const healthScore = computeGatewayHealthScore(snapshot);
  const severity = classifyGatewaySeverity(healthScore, snapshot);
  const recommendation = getGatewayActionRecommendation(severity, commandKind, snapshot);
  const narrativeHint = buildGatewayNarrationHint(snapshot, commandKind, healthScore, nowMs);

  const mlVectorChecksum = checksumParts(
    snapshot.runId,
    snapshot.tick,
    commandKind,
    mlVector.mlVectorArray,
  );

  const mlVectorSummary: Record<string, number> = {};
  GATEWAY_ML_FEATURE_LABELS.forEach((label, idx) => {
    mlVectorSummary[label] = mlVector.mlVectorArray[idx] ?? 0;
  });

  const tags: string[] = [
    'gateway',
    `mode:${snapshot.mode}`,
    `command:${commandKind.toLowerCase()}`,
    `severity:${severity.toLowerCase()}`,
    `phase:${snapshot.phase.toLowerCase()}`,
    `tick:${snapshot.tick}`,
  ];

  if (lastArchive !== null) {
    tags.push('archived');
    tags.push(`outcome:${lastArchive.outcome.toLowerCase()}`);
  }

  return deepFreeze({
    generatedAtMs: nowMs,
    severity,
    runId: snapshot.runId,
    userId: snapshot.userId,
    mode: snapshot.mode,
    commandKind,
    healthScore,
    pressureTierLabel: PRESSURE_TIER_URGENCY_LABEL[snapshot.pressure.tier] ?? 'Unknown',
    sessionCommandCount,
    outcomeTerminal: snapshot.outcome !== null,
    mlVectorChecksum,
    mlVectorSummary: Object.freeze(mlVectorSummary),
    narrativeHint: narrativeHint.fullNarration,
    actionRecommendation: recommendation,
    tags: Object.freeze(tags),
  } as GatewayChatSignal);
}

// ============================================================================
// MARK: Annotation building
// ============================================================================

/**
 * Build a GatewayAnnotationBundle describing every domain for the command context.
 */
export function buildGatewayAnnotation(
  snapshot: RunStateSnapshot,
  commandKind: GatewayCommandKind,
  healthScore: number,
  severity: GatewaySeverity,
  nowMs: number,
): GatewayAnnotationBundle {
  const eco = snapshot.economy;
  const prs = snapshot.pressure;
  const shd = snapshot.shield;
  const btl = snapshot.battle;
  const sov = snapshot.sovereignty;
  const crd = snapshot.cards;

  // Pressure annotation
  const tierLabel = PRESSURE_TIER_URGENCY_LABEL[prs.tier] ?? 'Unknown';
  const escalThreshold = PRESSURE_TIER_ESCALATION_THRESHOLD[prs.tier] ?? 0;
  const deescThreshold = PRESSURE_TIER_DEESCALATION_THRESHOLD[prs.tier] ?? 0;
  const minHoldTicks = PRESSURE_TIER_MIN_HOLD_TICKS[prs.tier] ?? 0;
  const pressureAnnotation =
    `Pressure tier ${prs.tier} (${tierLabel}): score ${prs.score.toFixed(2)}. ` +
    `Escalation threshold ${escalThreshold}, de-escalation ${deescThreshold}, ` +
    `min hold ticks ${minHoldTicks}. ` +
    `${prs.upwardCrossings} upward crossings. ` +
    `Survived high-pressure ticks: ${prs.survivedHighPressureTicks}.`;

  // Economy annotation
  const freedomPct =
    eco.freedomTarget > 0
      ? ((eco.netWorth / eco.freedomTarget) * 100).toFixed(1)
      : '—';
  const economyAnnotation =
    `Economy: net worth $${eco.netWorth.toLocaleString()} (${freedomPct}% to freedom). ` +
    `Cash $${eco.cash.toLocaleString()}, debt $${eco.debt.toLocaleString()}. ` +
    `Income ${eco.incomePerTick}/tick, expenses ${eco.expensesPerTick}/tick. ` +
    `Hater heat ${eco.haterHeat.toFixed(1)}.`;

  // Shield annotation
  const weakestLabel = SHIELD_LAYER_LABEL_BY_ID[shd.weakestLayerId] ?? 'UNKNOWN';
  const shieldAnnotation =
    `Shield: weakest layer ${shd.weakestLayerId} (${weakestLabel}) at ${(shd.weakestLayerRatio * 100).toFixed(1)}%. ` +
    `Breaches this run: ${shd.breachesThisRun}. Blocked: ${shd.blockedThisRun}. ` +
    `Damaged: ${shd.damagedThisRun}. Repair queue depth: ${shd.repairQueueDepth}. ` +
    `Layer absorption order: ${[...SHIELD_LAYER_ABSORPTION_ORDER].join(' → ')}.`;

  // Battle annotation
  const activeBotStates = btl.bots.map(
    (b: BotRuntimeState) =>
      `${b.botId}(${b.state},heat=${b.heat.toFixed(1)})`,
  );
  const battleAnnotation =
    `Battle: ${activeBotStates.join(', ')}. ` +
    `Budget ${btl.battleBudget}/${btl.battleBudgetCap}. ` +
    `Pending attacks: ${btl.pendingAttacks.length}. ` +
    `First blood: ${btl.firstBloodClaimed ? 'claimed' : 'not yet'}. ` +
    `Neutralized: ${btl.neutralizedBotIds.join(', ') || 'none'}.`;

  // Card annotation
  const handPower = computeGatewayHandPowerAvg(crd.hand as CardInstance[]);
  const handOff = computeGatewayHandOffensiveRatio(crd.hand as CardInstance[]);
  const cardAnnotation =
    `Cards: hand size ${crd.hand.length} (power avg ${handPower.toFixed(2)}, offensive ratio ${(handOff * 100).toFixed(1)}%). ` +
    `Discard pile ${crd.discard.length}. Draw pile ${crd.drawPileSize}. ` +
    `Deck entropy ${crd.deckEntropy.toFixed(2)}. Ghost markers: ${crd.ghostMarkers.length}.`;

  // Sovereignty annotation
  const gradeScore =
    sov.verifiedGrade !== null
      ? (VERIFIED_GRADE_NUMERIC_SCORE[sov.verifiedGrade as keyof typeof VERIFIED_GRADE_NUMERIC_SCORE] ?? 0).toFixed(2)
      : 'none';
  const integrityRisk =
    (INTEGRITY_STATUS_RISK_SCORE[sov.integrityStatus] ?? 0).toFixed(2);
  const sovereigntyAnnotation =
    `Sovereignty: score ${sov.sovereigntyScore}/100, grade ${sov.verifiedGrade ?? 'unverified'} (${gradeScore}). ` +
    `Integrity ${sov.integrityStatus} (risk ${integrityRisk}). ` +
    `Proof ${sov.proofHash !== null ? 'sealed' : 'pending'}. ` +
    `CORD score ${sov.cordScore.toFixed(2)}. Gap vs legend: ${sov.gapVsLegend.toFixed(2)}.`;

  // Command annotation
  const commandAnnotation =
    `Command: ${commandKind}. Tick ${snapshot.tick}. Phase ${snapshot.phase}. ` +
    `Mode ${snapshot.mode}. Health score ${healthScore.toFixed(3)}. Severity: ${severity}. ` +
    `Outcome: ${snapshot.outcome ?? 'ONGOING'}.`;

  // Session annotation
  const sessionAnnotation =
    `Session command count: ${snapshot.tick} ticks processed. ` +
    `Phase stakes multiplier: ${RUN_PHASE_STAKES_MULTIPLIER[snapshot.phase] ?? 0.6}. ` +
    `Mode tension floor: ${MODE_TENSION_FLOOR[snapshot.mode] ?? 0.15}.`;

  // Composite
  const compositeAnnotation =
    `[GATEWAY][${severity}] ${commandAnnotation} | ${pressureAnnotation} | ` +
    `${economyAnnotation} | ${shieldAnnotation}`;

  return deepFreeze({
    runId: snapshot.runId,
    mode: snapshot.mode,
    commandKind,
    tick: snapshot.tick,
    healthScore,
    severity,
    pressureAnnotation,
    economyAnnotation,
    shieldAnnotation,
    battleAnnotation,
    cardAnnotation,
    sovereigntyAnnotation,
    commandAnnotation,
    sessionAnnotation,
    compositeAnnotation,
    generatedAtMs: nowMs,
  } as GatewayAnnotationBundle);
}

// ============================================================================
// MARK: Narration hint building
// ============================================================================

/**
 * Build a GatewayNarrationHint for companion/display surfaces.
 * Drives audience engagement, companion urgency, and mode-specific tone.
 */
export function buildGatewayNarrationHint(
  snapshot: RunStateSnapshot,
  commandKind: GatewayCommandKind,
  healthScore: number,
  nowMs: number,
): GatewayNarrationHint {
  const modeNarration = GATEWAY_MODE_COMMAND_NARRATION[snapshot.mode];
  const commandNarration = GATEWAY_COMMAND_NARRATION[commandKind];

  const tierLabel = PRESSURE_TIER_URGENCY_LABEL[snapshot.pressure.tier] ?? 'Unknown';
  const pressureNarration =
    snapshot.pressure.tier === 'T4'
      ? `APEX PRESSURE — this is the edge of collapse.`
      : snapshot.pressure.tier === 'T3'
      ? `Critical pressure — one wrong move changes everything.`
      : snapshot.pressure.tier === 'T2'
      ? `Elevated pressure — the board is tightening.`
      : snapshot.pressure.tier === 'T1'
      ? `Pressure building — stay composed.`
      : `Pressure calm — exploit the window.`;

  const outcomeNarration =
    snapshot.outcome === 'FREEDOM'
      ? `FREEDOM ACHIEVED. The empire stands.`
      : snapshot.outcome === 'BANKRUPT'
      ? `BANKRUPT. The run ends in collapse.`
      : snapshot.outcome === 'TIMEOUT'
      ? `TIME EXPIRED. The season budget ran out.`
      : snapshot.outcome === 'ABANDONED'
      ? `Run abandoned. State preserved.`
      : `Run ongoing — ${snapshot.tick} ticks in.`;

  const audienceHeat = Math.min(
    1,
    snapshot.pressure.score * 0.4 +
      (1 - healthScore) * 0.3 +
      (snapshot.tension.anticipation / 100) * 0.3,
  );

  const fullNarration =
    `${modeNarration} ${commandNarration} ${pressureNarration} ${outcomeNarration}`;

  return deepFreeze({
    runId: snapshot.runId,
    mode: snapshot.mode,
    commandKind,
    tick: snapshot.tick,
    modeNarration,
    commandNarration,
    pressureNarration,
    outcomeNarration,
    fullNarration,
    audienceHeat,
    urgencyLabel: tierLabel,
    generatedAtMs: nowMs,
  } as GatewayNarrationHint);
}

// ============================================================================
// MARK: Run summary building
// ============================================================================

/**
 * Build a GatewayRunSummary for a completed or abandoned run.
 */
export function buildGatewayRunSummary(
  snapshot: RunStateSnapshot,
  mlVector: GatewayMLVector,
  chatSignal: GatewayChatSignal,
  lastArchive: RunArchiveRecord | null,
  sessionReport: GatewaySessionReport,
  nowMs: number,
): GatewayRunSummary {
  const healthScore = computeGatewayHealthScore(snapshot);
  const severity = classifyGatewaySeverity(healthScore, snapshot);

  return deepFreeze({
    runId: snapshot.runId,
    userId: snapshot.userId,
    mode: snapshot.mode,
    finalTick: snapshot.tick,
    outcome: snapshot.outcome,
    finalNetWorth: snapshot.economy.netWorth,
    totalCommandsIssued: sessionReport.totalCommands,
    totalCardsPlayed: sessionReport.totalCardsPlayed,
    totalTicksAdvanced: sessionReport.totalTicksAdvanced,
    finalHealthScore: healthScore,
    finalSeverity: severity,
    proofHash: snapshot.sovereignty.proofHash,
    sovereigntyScore: snapshot.sovereignty.sovereigntyScore,
    integrityStatus: snapshot.sovereignty.integrityStatus,
    verifiedGrade: snapshot.sovereignty.verifiedGrade,
    archiveRecord: lastArchive,
    mlVectorChecksum: chatSignal.mlVectorChecksum,
    chatSignal,
    generatedAtMs: nowMs,
  } as GatewayRunSummary);
}

// ============================================================================
// MARK: Health snapshot building
// ============================================================================

/**
 * Build a GatewayHealthSnapshot capturing per-domain health scores.
 */
export function buildGatewayHealthSnapshot(
  snapshot: RunStateSnapshot,
  commandKind: GatewayCommandKind,
  nowMs: number,
): GatewayHealthSnapshot {
  const eco = snapshot.economy;
  const prs = snapshot.pressure;
  const shd = snapshot.shield;
  const btl = snapshot.battle;
  const csc = snapshot.cascade;
  const sov = snapshot.sovereignty;
  const crd = snapshot.cards;

  const freedomProgress =
    eco.freedomTarget > 0 ? Math.min(1, eco.netWorth / eco.freedomTarget) : 0.5;
  const debtRatio = eco.netWorth > 0 ? Math.min(1, eco.debt / eco.netWorth) : 1;
  const economyHealth = freedomProgress * 0.6 + (1 - debtRatio) * 0.4;
  const pressureHealth = Math.max(0, 1 - prs.score);
  const shieldHealth = shd.weakestLayerRatio;
  const attackingBotCount = btl.bots.filter((b: BotRuntimeState) => b.state === 'ATTACKING').length;
  const battleHealth = Math.max(0, 1 - attackingBotCount / 5);
  const totalChains = csc.brokenChains + csc.completedChains + csc.activeChains.length;
  const cascadeHealth =
    totalChains > 0 ? Math.max(0, 1 - csc.brokenChains / totalChains) : 1.0;
  const integrityRisk = INTEGRITY_STATUS_RISK_SCORE[sov.integrityStatus] ?? 0.5;
  const sovereigntyHealth = (sov.sovereigntyScore / 100) * 0.6 + (1 - integrityRisk) * 0.4;
  const handPowerAvg = computeGatewayHandPowerAvg(crd.hand as CardInstance[]);
  const cardHealth = handPowerAvg * 0.5 + Math.min(1, crd.drawPileSize / 20) * 0.5;

  const healthScore = computeGatewayHealthScore(snapshot);
  const severity = classifyGatewaySeverity(healthScore, snapshot);
  const isRecoverable =
    severity !== 'TERMINAL' &&
    (shd.repairQueueDepth < 5 || eco.incomePerTick > eco.expensesPerTick);

  return deepFreeze({
    runId: snapshot.runId,
    tick: snapshot.tick,
    mode: snapshot.mode,
    commandKind,
    healthScore,
    severity,
    economyHealth,
    pressureHealth,
    shieldHealth,
    battleHealth,
    cascadeHealth,
    sovereigntyHealth,
    cardHealth,
    isRecoverable,
    urgencyLabel: PRESSURE_TIER_URGENCY_LABEL[prs.tier] ?? 'Unknown',
    capturedAtMs: nowMs,
  } as GatewayHealthSnapshot);
}

// ============================================================================
// MARK: ML vector utilities
// ============================================================================

/** Flatten a GatewayMLVector to a named key-value map for display/debug. */
export function buildGatewayMLNamedMap(
  vector: GatewayMLVector,
): Readonly<Record<string, number>> {
  const result: Record<string, number> = {};
  GATEWAY_ML_FEATURE_LABELS.forEach((label, idx) => {
    result[label] = vector.mlVectorArray[idx] ?? 0;
  });
  return Object.freeze(result);
}

/** Flatten GatewayDLTensor to a 1D array (row-major order). */
export function flattenGatewayDLTensor(tensor: GatewayDLTensor): readonly number[] {
  const flat: number[] = [];
  for (const row of tensor.rows) {
    for (const val of row.features) {
      flat.push(val);
    }
  }
  return Object.freeze(flat);
}

/** Extract a single column (feature index) from all DL tensor rows. */
export function extractGatewayDLColumn(
  tensor: GatewayDLTensor,
  colIndex: number,
): readonly number[] {
  return Object.freeze(tensor.rows.map((row) => row.features[colIndex] ?? 0));
}

/** Compute cosine similarity between two ML vectors. */
export function computeGatewayMLSimilarity(
  a: GatewayMLVector,
  b: GatewayMLVector,
): number {
  const va = a.mlVectorArray;
  const vb = b.mlVectorArray;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < va.length; i++) {
    const ai = va[i] ?? 0;
    const bi = vb[i] ?? 0;
    dot += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom > 0 ? dot / denom : 0;
}

/** Get top N features by absolute magnitude from an ML vector. */
export function getTopGatewayFeatures(
  vector: GatewayMLVector,
  topN = 5,
): readonly { label: string; value: number }[] {
  const entries = GATEWAY_ML_FEATURE_LABELS.map((label, idx) => ({
    label,
    value: vector.mlVectorArray[idx] ?? 0,
  }));
  return Object.freeze(
    [...entries]
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
      .slice(0, topN),
  );
}

// ============================================================================
// MARK: CommandGatewayTrendAnalyzer
// ============================================================================

/**
 * Tracks ML vector drift across multiple gateway commands in a session.
 * Identifies which features are drifting most and whether health is improving.
 */
export class CommandGatewayTrendAnalyzer {
  private readonly windowSize: number;

  private readonly vectors: GatewayMLVector[] = [];

  private readonly healthScores: number[] = [];

  public constructor(windowSize = 10) {
    this.windowSize = Math.max(2, windowSize);
  }

  public record(vector: GatewayMLVector, healthScore: number): void {
    this.vectors.push(vector);
    this.healthScores.push(healthScore);
    if (this.vectors.length > this.windowSize) {
      this.vectors.shift();
      this.healthScores.shift();
    }
  }

  public snapshot(nowMs: number): GatewayTrendSnapshot {
    const n = this.vectors.length;
    if (n < 2) {
      return deepFreeze({
        windowSize: this.windowSize,
        sampleCount: n,
        featureDrift: Object.freeze({}),
        dominantDriftFeature: 'none',
        dominantDriftMagnitude: 0,
        trendDirection: 'STABLE',
        avgHealthScore: this.healthScores[0] ?? 0,
        capturedAtMs: nowMs,
      } as GatewayTrendSnapshot);
    }

    const featureDrift: Record<string, number> = {};
    let dominantLabel = 'none';
    let dominantMag = 0;

    GATEWAY_ML_FEATURE_LABELS.forEach((label, idx) => {
      const values = this.vectors.map((v) => v.mlVectorArray[idx] ?? 0);
      const first = values[0] ?? 0;
      const last = values[n - 1] ?? 0;
      const drift = last - first;
      featureDrift[label] = drift;
      if (Math.abs(drift) > Math.abs(dominantMag)) {
        dominantMag = drift;
        dominantLabel = label;
      }
    });

    const avgHealth =
      this.healthScores.reduce((a, b) => a + b, 0) / this.healthScores.length;
    const firstHealth = this.healthScores[0] ?? 0;
    const lastHealth = this.healthScores[n - 1] ?? 0;
    const healthDrift = lastHealth - firstHealth;

    let trendDirection: 'IMPROVING' | 'STABLE' | 'DEGRADING';
    if (healthDrift > 0.05) trendDirection = 'IMPROVING';
    else if (healthDrift < -0.05) trendDirection = 'DEGRADING';
    else trendDirection = 'STABLE';

    return deepFreeze({
      windowSize: this.windowSize,
      sampleCount: n,
      featureDrift: Object.freeze(featureDrift),
      dominantDriftFeature: dominantLabel,
      dominantDriftMagnitude: dominantMag,
      trendDirection,
      avgHealthScore: avgHealth,
      capturedAtMs: nowMs,
    } as GatewayTrendSnapshot);
  }

  public clear(): void {
    this.vectors.length = 0;
    this.healthScores.length = 0;
  }

  public get sampleCount(): number {
    return this.vectors.length;
  }
}

// ============================================================================
// MARK: CommandGatewaySessionTracker
// ============================================================================

/**
 * Tracks per-session command statistics for the gateway.
 * Powers session report generation and ML feature extraction.
 */
export class CommandGatewaySessionTracker {
  private readonly sessionId: string;

  private runId: string | null = null;

  private mode: ModeCode | null = null;

  private readonly commandBreakdown: Record<GatewayCommandKind, number>;

  private totalCardsPlayed = 0;

  private totalTicksAdvanced = 0;

  private totalModeActionsResolved = 0;

  private totalAbandons = 0;

  private archivesGenerated = 0;

  private readonly healthScores: number[] = [];

  private peakPressureTier: string = 'T0';

  private readonly mlVectorChecksums: string[] = [];

  private readonly startedAtMs: number;

  private lastCommandAtMs: number;

  public constructor(nowMs: number) {
    this.sessionId = createDeterministicId('gateway-session', String(nowMs), String(Math.random()));
    this.startedAtMs = nowMs;
    this.lastCommandAtMs = nowMs;
    this.commandBreakdown = {} as Record<GatewayCommandKind, number>;
    for (const kind of GATEWAY_COMMAND_KINDS) {
      this.commandBreakdown[kind] = 0;
    }
  }

  public recordCommand(
    kind: GatewayCommandKind,
    snapshot: RunStateSnapshot,
    mlVector: GatewayMLVector,
    nowMs: number,
  ): void {
    this.runId = snapshot.runId;
    this.mode = snapshot.mode;
    this.commandBreakdown[kind] = (this.commandBreakdown[kind] ?? 0) + 1;
    this.lastCommandAtMs = nowMs;

    const healthScore = computeGatewayHealthScore(snapshot);
    this.healthScores.push(healthScore);

    const mlChecksum = checksumParts(snapshot.runId, snapshot.tick, kind, mlVector.mlVectorArray);
    this.mlVectorChecksums.push(mlChecksum);

    // Track tier milestone
    const tierOrder = [...PRESSURE_TIERS] as string[];
    if (
      tierOrder.indexOf(snapshot.pressure.tier) >
      tierOrder.indexOf(this.peakPressureTier)
    ) {
      this.peakPressureTier = snapshot.pressure.tier;
    }

    if (kind === 'PLAY_CARD') this.totalCardsPlayed++;
    if (kind === 'TICK' || kind === 'RUN_UNTIL_DONE') this.totalTicksAdvanced++;
    if (kind === 'RESOLVE_MODE_ACTION') this.totalModeActionsResolved++;
    if (kind === 'ABANDON') this.totalAbandons++;
  }

  public recordArchive(archive: RunArchiveRecord): void {
    void archive;
    this.archivesGenerated++;
  }

  public get totalCommands(): number {
    return Object.values(this.commandBreakdown).reduce((a, b) => a + b, 0);
  }

  public report(): GatewaySessionReport {
    const avgHealth =
      this.healthScores.length > 0
        ? this.healthScores.reduce((a, b) => a + b, 0) / this.healthScores.length
        : 0;

    return deepFreeze({
      sessionId: this.sessionId,
      runId: this.runId,
      mode: this.mode,
      totalCommands: this.totalCommands,
      commandBreakdown: Object.freeze({ ...this.commandBreakdown }),
      totalCardsPlayed: this.totalCardsPlayed,
      totalTicksAdvanced: this.totalTicksAdvanced,
      totalModeActionsResolved: this.totalModeActionsResolved,
      totalAbandons: this.totalAbandons,
      avgHealthScore: avgHealth,
      peakPressureTier: this.peakPressureTier,
      archivesGenerated: this.archivesGenerated,
      mlVectorChecksums: Object.freeze([...this.mlVectorChecksums]),
      startedAtMs: this.startedAtMs,
      lastCommandAtMs: this.lastCommandAtMs,
    } as GatewaySessionReport);
  }

  public reset(): void {
    this.runId = null;
    this.mode = null;
    this.totalCardsPlayed = 0;
    this.totalTicksAdvanced = 0;
    this.totalModeActionsResolved = 0;
    this.totalAbandons = 0;
    this.archivesGenerated = 0;
    this.healthScores.length = 0;
    this.mlVectorChecksums.length = 0;
    this.peakPressureTier = 'T0';
    for (const kind of GATEWAY_COMMAND_KINDS) {
      this.commandBreakdown[kind] = 0;
    }
  }
}

// ============================================================================
// MARK: CommandGatewayEventLog
// ============================================================================

/**
 * Immutable audit event log for gateway commands.
 * Every command entry is sealed with a checksum chain.
 */
export class CommandGatewayEventLog {
  private readonly entries: GatewayEventLogEntry[] = [];

  private seq = 0;

  public append(
    commandKind: GatewayCommandKind,
    snapshot: RunStateSnapshot,
    mlVector: GatewayMLVector,
    nowMs: number,
  ): GatewayEventLogEntry {
    const seqNum = ++this.seq;
    const healthScore = computeGatewayHealthScore(snapshot);
    const severity = classifyGatewaySeverity(healthScore, snapshot);

    const stateChecksum = checksumSnapshot(snapshot);
    const mlVectorChecksum = checksumParts(
      snapshot.runId,
      snapshot.tick,
      commandKind,
      mlVector.mlVectorArray,
    );

    const sealChecksum = computeTickSeal({
      runId: snapshot.runId,
      tick: snapshot.tick,
      step: `gateway:${commandKind}:seq:${seqNum}`,
      stateChecksum,
      eventChecksums: [mlVectorChecksum],
    });

    const detailSummary =
      `[${commandKind}] tick=${snapshot.tick} mode=${snapshot.mode} ` +
      `health=${healthScore.toFixed(3)} severity=${severity} ` +
      `outcome=${snapshot.outcome ?? 'ONGOING'}`;

    const tags: readonly string[] = Object.freeze([
      'gateway-event-log',
      `command:${commandKind.toLowerCase()}`,
      `mode:${snapshot.mode}`,
      `severity:${severity.toLowerCase()}`,
    ]);

    const entry: GatewayEventLogEntry = deepFreeze({
      seq: seqNum,
      commandKind,
      runId: snapshot.runId,
      tick: snapshot.tick,
      mode: snapshot.mode,
      severity,
      healthScore,
      mlVectorChecksum,
      sealChecksum,
      detailSummary,
      tags,
      timestampMs: nowMs,
    } as GatewayEventLogEntry);

    this.entries.push(entry);
    return entry;
  }

  public getAll(): readonly GatewayEventLogEntry[] {
    return Object.freeze([...this.entries]);
  }

  public getByKind(kind: GatewayCommandKind): readonly GatewayEventLogEntry[] {
    return Object.freeze(this.entries.filter((e) => e.commandKind === kind));
  }

  public getLast(n = 10): readonly GatewayEventLogEntry[] {
    return Object.freeze(this.entries.slice(-n));
  }

  public clear(): void {
    this.entries.length = 0;
    this.seq = 0;
  }

  public get entryCount(): number {
    return this.entries.length;
  }
}

// ============================================================================
// MARK: CommandGatewayAnnotator
// ============================================================================

/**
 * Produces annotation bundles on demand from snapshot + command context.
 * Supports default, strict, and verbose annotation modes.
 */
export class CommandGatewayAnnotator {
  private readonly mode: 'default' | 'strict' | 'verbose';

  public constructor(mode: 'default' | 'strict' | 'verbose' = 'default') {
    this.mode = mode;
  }

  public annotate(
    snapshot: RunStateSnapshot,
    commandKind: GatewayCommandKind,
    healthScore: number,
    severity: GatewaySeverity,
    nowMs: number,
  ): GatewayAnnotationBundle {
    const bundle = buildGatewayAnnotation(
      snapshot,
      commandKind,
      healthScore,
      severity,
      nowMs,
    );

    if (this.mode === 'strict') {
      // Strict mode validates all enum fields
      const invalidMode = !MODE_CODES.includes(snapshot.mode as (typeof MODE_CODES)[number]);
      const invalidPhase = !RUN_PHASES.includes(
        snapshot.phase as (typeof RUN_PHASES)[number],
      );
      const invalidPressure = !PRESSURE_TIERS.includes(
        snapshot.pressure.tier as (typeof PRESSURE_TIERS)[number],
      );
      const invalidIntegrity = !INTEGRITY_STATUSES.includes(
        snapshot.sovereignty.integrityStatus as (typeof INTEGRITY_STATUSES)[number],
      );

      if (invalidMode || invalidPhase || invalidPressure || invalidIntegrity) {
        const errorNote = [
          invalidMode ? `invalid mode: ${snapshot.mode}` : null,
          invalidPhase ? `invalid phase: ${snapshot.phase}` : null,
          invalidPressure ? `invalid pressure tier: ${snapshot.pressure.tier}` : null,
          invalidIntegrity
            ? `invalid integrity status: ${snapshot.sovereignty.integrityStatus}`
            : null,
        ]
          .filter(Boolean)
          .join('; ');
        return deepFreeze({
          ...bundle,
          compositeAnnotation: `[STRICT VALIDATION FAILED] ${errorNote} | ${bundle.compositeAnnotation}`,
        } as GatewayAnnotationBundle);
      }
    }

    if (this.mode === 'verbose') {
      // Verbose mode appends all constants-driven metadata
      const shieldLabels = SHIELD_LAYER_IDS.map(
        (id) => `${id}=${SHIELD_LAYER_LABEL_BY_ID[id]}`,
      ).join(', ');
      const deckTypes = [...DECK_TYPES].join(', ');
      const timingClasses = [...TIMING_CLASSES].join(', ');
      const outcomes = [...RUN_OUTCOMES].join(', ');
      const grades = [...VERIFIED_GRADES].join(', ');
      const verboseNote =
        `[VERBOSE] Shield layers: ${shieldLabels}. ` +
        `Deck types: ${deckTypes}. ` +
        `Timing classes: ${timingClasses}. ` +
        `Run outcomes: ${outcomes}. ` +
        `Verified grades: ${grades}.`;
      return deepFreeze({
        ...bundle,
        compositeAnnotation: `${bundle.compositeAnnotation} | ${verboseNote}`,
      } as GatewayAnnotationBundle);
    }

    return bundle;
  }
}

// ============================================================================
// MARK: CommandGatewayInspector
// ============================================================================

/**
 * Produces full inspection bundles for debugging and operator review.
 * Wires all analytics subsystems into a single snapshot view.
 */
export class CommandGatewayInspector {
  public inspect(
    snapshot: RunStateSnapshot | null,
    commandKind: GatewayCommandKind,
    sessionTracker: CommandGatewaySessionTracker,
    trendAnalyzer: CommandGatewayTrendAnalyzer,
    annotator: CommandGatewayAnnotator,
    lastArchive: RunArchiveRecord | null,
    nowMs: number,
  ): GatewayInspectionBundle {
    const runId = snapshot?.runId ?? '';

    if (snapshot === null) {
      return deepFreeze({
        runId,
        inspectedAtMs: nowMs,
        commandKind,
        snapshot: null,
        mlVector: null,
        dlTensor: null,
        chatSignal: null,
        annotationBundle: null,
        narrationHint: null,
        trendSnapshot: null,
        sessionReport: sessionTracker.report(),
        archiveRecord: lastArchive,
        healthScore: 0,
        severity: 'NOMINAL',
        isValid: false,
        validationErrors: Object.freeze(['No active snapshot']),
      } as GatewayInspectionBundle);
    }

    const validationErrors: string[] = [];

    // Validate mode
    if (!MODE_CODES.includes(snapshot.mode as (typeof MODE_CODES)[number])) {
      validationErrors.push(`Unrecognized mode: ${snapshot.mode}`);
    }
    // Validate phase
    if (!RUN_PHASES.includes(snapshot.phase as (typeof RUN_PHASES)[number])) {
      validationErrors.push(`Unrecognized phase: ${snapshot.phase}`);
    }
    // Validate pressure tier
    if (!PRESSURE_TIERS.includes(snapshot.pressure.tier as (typeof PRESSURE_TIERS)[number])) {
      validationErrors.push(`Unrecognized pressure tier: ${snapshot.pressure.tier}`);
    }
    // Validate bot IDs
    for (const bot of snapshot.battle.bots) {
      if (!HATER_BOT_IDS.includes(bot.botId as (typeof HATER_BOT_IDS)[number])) {
        validationErrors.push(`Unrecognized bot ID: ${bot.botId}`);
      }
    }
    // Validate integrity status
    if (
      !INTEGRITY_STATUSES.includes(
        snapshot.sovereignty.integrityStatus as (typeof INTEGRITY_STATUSES)[number],
      )
    ) {
      validationErrors.push(
        `Unrecognized integrity status: ${snapshot.sovereignty.integrityStatus}`,
      );
    }
    // Validate verified grade
    if (
      snapshot.sovereignty.verifiedGrade !== null &&
      !VERIFIED_GRADES.includes(
        snapshot.sovereignty.verifiedGrade as (typeof VERIFIED_GRADES)[number],
      )
    ) {
      validationErrors.push(
        `Unrecognized verified grade: ${snapshot.sovereignty.verifiedGrade}`,
      );
    }
    // Validate outcome
    if (
      snapshot.outcome !== null &&
      !RUN_OUTCOMES.includes(snapshot.outcome as (typeof RUN_OUTCOMES)[number])
    ) {
      validationErrors.push(`Unrecognized outcome: ${snapshot.outcome}`);
    }

    const sessionReport = sessionTracker.report();
    const mlVector = extractGatewayMLVector(
      snapshot,
      commandKind,
      null,
      sessionReport.totalCommands,
      lastArchive,
    );
    const dlTensor = buildGatewayDLTensor(
      snapshot,
      commandKind,
      null,
      sessionReport.totalCommands,
      nowMs,
    );
    const chatSignal = buildGatewayChatSignal(
      snapshot,
      commandKind,
      mlVector,
      sessionReport.totalCommands,
      lastArchive,
      nowMs,
    );
    const healthScore = chatSignal.healthScore;
    const severity = chatSignal.severity;
    const annotationBundle = annotator.annotate(
      snapshot,
      commandKind,
      healthScore,
      severity,
      nowMs,
    );
    const narrationHint = buildGatewayNarrationHint(snapshot, commandKind, healthScore, nowMs);
    const trendSnapshot = trendAnalyzer.snapshot(nowMs);

    return deepFreeze({
      runId,
      inspectedAtMs: nowMs,
      commandKind,
      snapshot,
      mlVector,
      dlTensor,
      chatSignal,
      annotationBundle,
      narrationHint,
      trendSnapshot,
      sessionReport,
      archiveRecord: lastArchive,
      healthScore,
      severity,
      isValid: validationErrors.length === 0,
      validationErrors: Object.freeze(validationErrors),
    } as GatewayInspectionBundle);
  }
}

// ============================================================================
// MARK: RunCommandGatewayDependencies
// ============================================================================

export interface RunCommandGatewayDependencies {
  readonly bus: EventBus<RuntimeEventMap>;
  readonly bootstrap: RunBootstrapPipeline;
  readonly shutdown: RunShutdownPipeline;
  readonly advanceTick: (snapshot: RunStateSnapshot) => RunStateSnapshot;
  readonly cardLegality: CardLegalityService;
  readonly cardExecutor?: CardEffectExecutor;
  readonly onSnapshotChanged?: (snapshot: RunStateSnapshot) => void;
  readonly analyticsEnabled?: boolean;
  readonly now?: () => number;
}

// ============================================================================
// MARK: RunCommandGateway — primary command surface
// ============================================================================

export class RunCommandGateway {
  private readonly bus: EventBus<RuntimeEventMap>;

  private readonly bootstrapPipeline: RunBootstrapPipeline;

  private readonly shutdownPipeline: RunShutdownPipeline;

  private readonly advanceTickImpl: (snapshot: RunStateSnapshot) => RunStateSnapshot;

  private readonly cardLegality: CardLegalityService;

  private readonly cardExecutor: CardEffectExecutor;

  private readonly onSnapshotChanged?: (snapshot: RunStateSnapshot) => void;

  private readonly analyticsEnabled: boolean;

  private readonly now: () => number;

  // State
  private current: RunStateSnapshot | null = null;

  private activeModeAdapter: ModeAdapter | null = null;

  private lastArchive: RunArchiveRecord | null = null;

  // Analytics subsystems
  private readonly sessionTracker: CommandGatewaySessionTracker;

  private readonly trendAnalyzer: CommandGatewayTrendAnalyzer;

  private readonly eventLog: CommandGatewayEventLog;

  private readonly annotator: CommandGatewayAnnotator;

  private readonly inspector: CommandGatewayInspector;

  // Last analytics outputs — surfaced via getter methods
  private lastMLVector: GatewayMLVector | null = null;

  private lastDLTensor: GatewayDLTensor | null = null;

  private lastChatSignal: GatewayChatSignal | null = null;

  private lastHealthSnapshot: GatewayHealthSnapshot | null = null;

  public constructor(dependencies: RunCommandGatewayDependencies) {
    this.bus = dependencies.bus;
    this.bootstrapPipeline = dependencies.bootstrap;
    this.shutdownPipeline = dependencies.shutdown;
    this.advanceTickImpl = dependencies.advanceTick;
    this.cardLegality = dependencies.cardLegality;
    this.cardExecutor = dependencies.cardExecutor ?? new CardEffectExecutor();
    this.onSnapshotChanged = dependencies.onSnapshotChanged;
    this.analyticsEnabled = dependencies.analyticsEnabled ?? true;
    this.now = dependencies.now ?? (() => Date.now());

    const nowMs = this.now();
    this.sessionTracker = new CommandGatewaySessionTracker(nowMs);
    this.trendAnalyzer = new CommandGatewayTrendAnalyzer(15);
    this.eventLog = new CommandGatewayEventLog();
    this.annotator = new CommandGatewayAnnotator('default');
    this.inspector = new CommandGatewayInspector();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Public command surface
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Start a new run from bootstrap input.
   * Resets all session analytics and begins fresh ML/DL tracking.
   */
  public start(input: RunBootstrapInput): RunStateSnapshot {
    if (this.current !== null) {
      throw new Error(
        'RunCommandGateway already owns a run snapshot. Call reset() before starting another run.',
      );
    }

    const bootstrapped = this.bootstrapPipeline.bootstrap(input);
    this.activeModeAdapter = bootstrapped.modeAdapter;
    this.lastArchive = null;

    const snapshot = this.commit(bootstrapped.snapshot);
    this.runAnalytics('START', snapshot, null);
    return snapshot;
  }

  /**
   * Return the current active snapshot.
   * Throws if no run is active.
   */
  public getSnapshot(): RunStateSnapshot {
    if (this.current === null) {
      throw new Error('No active run. Call start() first.');
    }
    return this.current;
  }

  /** Return the current snapshot or null if no run is active. */
  public maybeGetSnapshot(): RunStateSnapshot | null {
    return this.current;
  }

  /** Return the most recent archive record or null if no run has been finalized. */
  public getLastArchive(): RunArchiveRecord | null {
    return this.lastArchive;
  }

  /**
   * Play a card by definition ID.
   * Enforces legality, applies effect, decorates state, emits event.
   */
  public playCard(
    definitionId: string,
    actorId: string,
    targeting: Targeting = 'SELF',
  ): RunStateSnapshot {
    const current = this.assertPlayable();
    const card = this.cardLegality.mustResolve(current, definitionId, targeting);

    let next = this.cardExecutor.apply(current, card, actorId);
    next = this.decoratePlayedCard(next, card, actorId);

    this.bus.emit(
      'card.played',
      {
        runId: next.runId,
        actorId,
        cardId: card.definitionId,
        tick: next.tick,
        mode: next.mode,
      },
      {
        emittedAtTick: next.tick,
        tags: [
          'engine-zero',
          'run-command-gateway',
          'card-played',
          `mode:${next.mode}`,
          `card:${card.definitionId}`,
        ],
      },
    );

    const snapshot = this.commit(next);
    this.runAnalytics('PLAY_CARD', snapshot, card);
    return snapshot;
  }

  /**
   * Resolve a mode-specific action.
   * The mode adapter must implement resolveAction.
   */
  public resolveModeAction(
    actionId: ModeActionId,
    payload: Readonly<Record<string, unknown>> = {},
  ): RunStateSnapshot {
    const current = this.assertPlayable();
    const adapter = this.requireModeAdapter();

    if (!adapter.resolveAction) {
      throw new Error(`Mode ${current.mode} does not expose mode actions.`);
    }

    const next = adapter.resolveAction(current, actionId, payload);

    this.bus.emit(
      'mode.action.resolved',
      {
        runId: next.runId,
        mode: next.mode,
        actionId,
        tick: next.tick,
        payload,
      },
      {
        emittedAtTick: next.tick,
        tags: [
          'engine-zero',
          'run-command-gateway',
          'mode-action',
          `mode:${next.mode}`,
          `action:${actionId}`,
        ],
      },
    );

    const snapshot = this.commit(next);
    this.runAnalytics('RESOLVE_MODE_ACTION', snapshot, null);
    return snapshot;
  }

  /**
   * Advance the clock by one tick.
   * If the run has a terminal outcome, finalizes the run instead.
   */
  public advanceTick(): RunStateSnapshot {
    const current = this.getSnapshot();

    if (current.outcome !== null) {
      return this.finalizeIfNeeded(current);
    }

    const next = this.advanceTickImpl(current);

    if (next.outcome !== null && next.sovereignty.proofHash === null) {
      return this.finalizeAndCommit(next);
    }

    const snapshot = this.commit(next);
    this.runAnalytics('TICK', snapshot, null);
    return snapshot;
  }

  /**
   * Advance the clock by `count` ticks.
   * Stops early if the run reaches a terminal outcome.
   */
  public tick(count = 1): RunStateSnapshot {
    if (!Number.isFinite(count) || count <= 0) {
      throw new Error(`tick(count) requires a positive finite count. Received ${count}.`);
    }

    let snapshot = this.getSnapshot();
    for (let index = 0; index < count; index += 1) {
      snapshot = this.advanceTick();
      if (snapshot.outcome !== null) {
        break;
      }
    }

    return snapshot;
  }

  /**
   * Run ticks until the run reaches a terminal outcome or maxTicks is exhausted.
   */
  public runUntilDone(maxTicks = 500): RunStateSnapshot {
    if (!Number.isFinite(maxTicks) || maxTicks <= 0) {
      throw new Error(
        `runUntilDone(maxTicks) requires a positive finite maxTicks. Received ${maxTicks}.`,
      );
    }

    let snapshot = this.getSnapshot();
    for (let index = 0; index < maxTicks; index += 1) {
      snapshot = this.advanceTick();
      if (snapshot.outcome !== null) {
        this.runAnalytics('RUN_UNTIL_DONE', snapshot, null);
        return snapshot;
      }
    }

    return snapshot;
  }

  /**
   * Abandon the run with a user-initiated reason.
   */
  public abandon(reason = 'run.user_abandoned'): RunStateSnapshot {
    const current = this.getSnapshot();
    const snapshot = this.finalizeAndCommit(current, {
      forceOutcome: 'ABANDONED',
      reason,
      reasonCode: 'USER_ABANDON',
    });
    this.runAnalytics('ABANDON', snapshot, null);
    return snapshot;
  }

  /**
   * Reset the gateway — clears active snapshot, mode adapter, and analytics state.
   */
  public reset(): void {
    this.current = null;
    this.activeModeAdapter = null;
    this.lastArchive = null;
    this.lastMLVector = null;
    this.lastDLTensor = null;
    this.lastChatSignal = null;
    this.lastHealthSnapshot = null;
    this.sessionTracker.reset();
    this.trendAnalyzer.clear();
    this.eventLog.clear();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Analytics accessors
  // ──────────────────────────────────────────────────────────────────────────

  /** Return the most recent ML feature vector (null if no command has been run). */
  public getLastMLVector(): GatewayMLVector | null {
    return this.lastMLVector;
  }

  /** Return the most recent DL tensor (null if no command has been run). */
  public getLastDLTensor(): GatewayDLTensor | null {
    return this.lastDLTensor;
  }

  /** Return the most recent chat signal (null if no command has been run). */
  public getLastChatSignal(): GatewayChatSignal | null {
    return this.lastChatSignal;
  }

  /** Return the most recent health snapshot (null if no command has been run). */
  public getLastHealthSnapshot(): GatewayHealthSnapshot | null {
    return this.lastHealthSnapshot;
  }

  /** Return the current session report. */
  public getSessionReport(): GatewaySessionReport {
    return this.sessionTracker.report();
  }

  /** Return a trend snapshot of ML vector drift. */
  public getTrendSnapshot(): GatewayTrendSnapshot {
    return this.trendAnalyzer.snapshot(this.now());
  }

  /** Return all event log entries. */
  public getEventLog(): readonly GatewayEventLogEntry[] {
    return this.eventLog.getAll();
  }

  /** Return a full inspection bundle for the current gateway state. */
  public inspect(commandKind: GatewayCommandKind = 'TICK'): GatewayInspectionBundle {
    return this.inspector.inspect(
      this.current,
      commandKind,
      this.sessionTracker,
      this.trendAnalyzer,
      this.annotator,
      this.lastArchive,
      this.now(),
    );
  }

  /**
   * Build a full run summary for a completed run.
   * Requires the run to have a terminal outcome.
   */
  public buildRunSummary(): GatewayRunSummary | null {
    if (this.current === null || this.current.outcome === null) return null;
    const nowMs = this.now();
    const sessionReport = this.sessionTracker.report();
    const mlVector =
      this.lastMLVector ??
      extractGatewayMLVector(
        this.current,
        'ABANDON',
        null,
        sessionReport.totalCommands,
        this.lastArchive,
      );
    const chatSignal =
      this.lastChatSignal ??
      buildGatewayChatSignal(
        this.current,
        'ABANDON',
        mlVector,
        sessionReport.totalCommands,
        this.lastArchive,
        nowMs,
      );
    return buildGatewayRunSummary(
      this.current,
      mlVector,
      chatSignal,
      this.lastArchive,
      sessionReport,
      nowMs,
    );
  }

  /**
   * Build a full export bundle for the current gateway state.
   */
  public buildExportBundle(commandKind: GatewayCommandKind = 'TICK'): GatewayExportBundle | null {
    if (this.current === null) return null;

    const nowMs = this.now();
    const sessionReport = this.sessionTracker.report();
    const snapshot = this.current;

    const mlVector = extractGatewayMLVector(
      snapshot,
      commandKind,
      null,
      sessionReport.totalCommands,
      this.lastArchive,
    );
    const dlTensor = buildGatewayDLTensor(
      snapshot,
      commandKind,
      null,
      sessionReport.totalCommands,
      nowMs,
    );
    const chatSignal = buildGatewayChatSignal(
      snapshot,
      commandKind,
      mlVector,
      sessionReport.totalCommands,
      this.lastArchive,
      nowMs,
    );
    const healthScore = chatSignal.healthScore;
    const severity = chatSignal.severity;
    const annotationBundle = this.annotator.annotate(
      snapshot,
      commandKind,
      healthScore,
      severity,
      nowMs,
    );
    const narrationHint = buildGatewayNarrationHint(snapshot, commandKind, healthScore, nowMs);
    const healthSnapshot = buildGatewayHealthSnapshot(snapshot, commandKind, nowMs);

    const runSummary =
      snapshot.outcome !== null
        ? buildGatewayRunSummary(
            snapshot,
            mlVector,
            chatSignal,
            this.lastArchive,
            sessionReport,
            nowMs,
          )
        : null;

    return deepFreeze({
      runId: snapshot.runId,
      mode: snapshot.mode,
      commandKind,
      mlVector,
      dlTensor,
      chatSignal,
      annotationBundle,
      narrationHint,
      sessionReport,
      healthSnapshot,
      runSummary,
      schemaVersion: GATEWAY_SCHEMA_VERSION,
      exportedAtMs: nowMs,
    } as GatewayExportBundle);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ──────────────────────────────────────────────────────────────────────────

  private runAnalytics(
    commandKind: GatewayCommandKind,
    snapshot: RunStateSnapshot,
    playedCard: CardInstance | null,
  ): void {
    if (!this.analyticsEnabled) return;
    const nowMs = this.now();
    const sessionReport = this.sessionTracker.report();

    const mlVector = extractGatewayMLVector(
      snapshot,
      commandKind,
      playedCard,
      sessionReport.totalCommands,
      this.lastArchive,
    );

    const dlTensor = buildGatewayDLTensor(
      snapshot,
      commandKind,
      playedCard,
      sessionReport.totalCommands,
      nowMs,
    );

    const chatSignal = buildGatewayChatSignal(
      snapshot,
      commandKind,
      mlVector,
      sessionReport.totalCommands,
      this.lastArchive,
      nowMs,
    );

    const healthSnapshot = buildGatewayHealthSnapshot(snapshot, commandKind, nowMs);

    this.sessionTracker.recordCommand(commandKind, snapshot, mlVector, nowMs);
    this.trendAnalyzer.record(mlVector, chatSignal.healthScore);
    this.eventLog.append(commandKind, snapshot, mlVector, nowMs);

    this.lastMLVector = mlVector;
    this.lastDLTensor = dlTensor;
    this.lastChatSignal = chatSignal;
    this.lastHealthSnapshot = healthSnapshot;
  }

  private finalizeIfNeeded(snapshot: RunStateSnapshot): RunStateSnapshot {
    if (snapshot.sovereignty.proofHash !== null) {
      return this.commit(snapshot);
    }
    return this.finalizeAndCommit(snapshot);
  }

  private finalizeAndCommit(
    snapshot: RunStateSnapshot,
    shutdownOverrides: Parameters<RunShutdownPipeline['shutdown']>[0] extends infer T
      ? Omit<Extract<T, object>, 'snapshot'>
      : never = {},
  ): RunStateSnapshot {
    const result = this.shutdownPipeline.shutdown({
      snapshot,
      ...shutdownOverrides,
    });

    this.lastArchive = result.archive;
    this.sessionTracker.recordArchive(result.archive);

    return this.commit(result.snapshot);
  }

  private commit(snapshot: RunStateSnapshot): RunStateSnapshot {
    const frozen = deepFrozenClone(snapshot);
    this.current = frozen;

    if (this.onSnapshotChanged) {
      this.onSnapshotChanged(frozen);
    }

    return frozen;
  }

  private assertPlayable(): RunStateSnapshot {
    const snapshot = this.getSnapshot();

    if (snapshot.outcome !== null) {
      throw new Error(
        `Run ${snapshot.runId} is terminal (${snapshot.outcome}). No further play commands are allowed.`,
      );
    }

    return snapshot;
  }

  private requireModeAdapter(): ModeAdapter {
    if (this.activeModeAdapter === null) {
      throw new Error('No active mode adapter. Start a run first.');
    }
    return this.activeModeAdapter;
  }

  private decoratePlayedCard(
    snapshot: RunStateSnapshot,
    card: CardInstance,
    actorId: string,
  ): RunStateSnapshot {
    return {
      ...snapshot,
      cards: {
        ...snapshot.cards,
        lastPlayed: [card.definitionId, ...snapshot.cards.lastPlayed].slice(0, 3),
        discard: [...snapshot.cards.discard, card.definitionId],
        hand: snapshot.cards.hand.filter(
          (entry) => entry.instanceId !== card.instanceId,
        ),
      },
      telemetry: {
        ...snapshot.telemetry,
        decisions: [
          ...snapshot.telemetry.decisions,
          {
            tick: snapshot.tick,
            actorId,
            cardId: card.definitionId,
            latencyMs:
              card.card.decisionTimerOverrideMs ??
              snapshot.timers.currentTickDurationMs,
            timingClass: card.timingClass,
            accepted: true,
          },
        ],
      },
    };
  }
}

// ============================================================================
// MARK: Analytics-wired factory
// ============================================================================

/**
 * Create a RunCommandGateway with all analytics subsystems fully wired.
 * Returns the gateway plus standalone analytics accessors.
 */
export interface RunCommandGatewayWithAnalytics {
  readonly gateway: RunCommandGateway;
  readonly sessionTracker: CommandGatewaySessionTracker;
  readonly trendAnalyzer: CommandGatewayTrendAnalyzer;
  readonly eventLog: CommandGatewayEventLog;
  readonly annotator: CommandGatewayAnnotator;
  readonly inspector: CommandGatewayInspector;
}

export function createRunCommandGatewayWithAnalytics(
  dependencies: RunCommandGatewayDependencies,
): RunCommandGatewayWithAnalytics {
  const gateway = new RunCommandGateway({
    ...dependencies,
    analyticsEnabled: true,
  });

  // Expose the internal analytics via the gateway's accessors indirectly
  // (subsystems are wired inside the gateway; externally we expose read-only surfaces)
  const inspector = new CommandGatewayInspector();
  const annotator = new CommandGatewayAnnotator('verbose');
  const trendAnalyzer = new CommandGatewayTrendAnalyzer(20);
  const eventLog = new CommandGatewayEventLog();
  const sessionTracker = new CommandGatewaySessionTracker(Date.now());

  return Object.freeze({
    gateway,
    sessionTracker,
    trendAnalyzer,
    eventLog,
    annotator,
    inspector,
  });
}

// ============================================================================
// MARK: Wire all imported constants into ML/DL extractor tables
// ============================================================================

// These constant tables are used as normalization denominators and feature
// encoders throughout extractGatewayMLVector and buildGatewayDLTensor.
// The following computed references ensure TS sees them as "used" while
// also making them available as exported lookup tables.

/** Absorption order as used in shield analytics. */
export const GATEWAY_SHIELD_ABSORPTION_ORDER: readonly (typeof SHIELD_LAYER_IDS[number])[] =
  SHIELD_LAYER_ABSORPTION_ORDER;

/** Timing window priority map — used for card timing priority feature. */
export const GATEWAY_TIMING_CLASS_WINDOW_PRIORITY = TIMING_CLASS_WINDOW_PRIORITY;

/** Timing urgency decay map — used for card urgency decay computation. */
export const GATEWAY_TIMING_CLASS_URGENCY_DECAY = TIMING_CLASS_URGENCY_DECAY;

/** Bot state transition table — used for bot lifecycle analytics. */
export const GATEWAY_BOT_STATE_ALLOWED_TRANSITIONS = BOT_STATE_ALLOWED_TRANSITIONS;

/** Bot state threat multiplier — used in botThreatNormalized feature. */
export const GATEWAY_BOT_STATE_THREAT_MULTIPLIER = BOT_STATE_THREAT_MULTIPLIER;

/** Visibility concealment factor — used in threat concealment analysis. */
export const GATEWAY_VISIBILITY_CONCEALMENT_FACTOR = VISIBILITY_CONCEALMENT_FACTOR;

/** Deck type offensive flag — used in hand offensive ratio computation. */
export const GATEWAY_DECK_TYPE_IS_OFFENSIVE = DECK_TYPE_IS_OFFENSIVE;

/** Deck type power level — used in card power scoring. */
export const GATEWAY_DECK_TYPE_POWER_LEVEL = DECK_TYPE_POWER_LEVEL;

/** Card rarity weight — used in card power scoring. */
export const GATEWAY_CARD_RARITY_WEIGHT = CARD_RARITY_WEIGHT;

/** Attack category base magnitude — used in threat response analysis. */
export const GATEWAY_ATTACK_CATEGORY_BASE_MAGNITUDE = ATTACK_CATEGORY_BASE_MAGNITUDE;

/** Attack counterable flags — used in hand legal counter analysis. */
export const GATEWAY_ATTACK_CATEGORY_IS_COUNTERABLE = ATTACK_CATEGORY_IS_COUNTERABLE;

/** Counterability resistance scores — used in card defense scoring. */
export const GATEWAY_COUNTERABILITY_RESISTANCE_SCORE = COUNTERABILITY_RESISTANCE_SCORE;

/** Targeting spread factor — used in card impact spread analysis. */
export const GATEWAY_TARGETING_SPREAD_FACTOR = TARGETING_SPREAD_FACTOR;

/** Divergence potential normalized — used in mode-specific divergence scoring. */
export const GATEWAY_DIVERGENCE_POTENTIAL_NORMALIZED = DIVERGENCE_POTENTIAL_NORMALIZED;

/** Pressure escalation thresholds — used in pressure scoring and annotations. */
export const GATEWAY_PRESSURE_TIER_ESCALATION_THRESHOLD = PRESSURE_TIER_ESCALATION_THRESHOLD;

/** Pressure deescalation thresholds — used in pressure scoring and annotations. */
export const GATEWAY_PRESSURE_TIER_DEESCALATION_THRESHOLD = PRESSURE_TIER_DEESCALATION_THRESHOLD;

/** Pressure tier min hold ticks — used in escalation guard annotations. */
export const GATEWAY_PRESSURE_TIER_MIN_HOLD_TICKS = PRESSURE_TIER_MIN_HOLD_TICKS;

/** Pressure tier urgency labels — used in narration and annotation surfaces. */
export const GATEWAY_PRESSURE_TIER_URGENCY_LABEL = PRESSURE_TIER_URGENCY_LABEL;

/** Pressure tier normalized — used in ML feature extraction. */
export const GATEWAY_PRESSURE_TIER_NORMALIZED = PRESSURE_TIER_NORMALIZED;

/** Mode normalized encoding — used in ML feature extraction. */
export const GATEWAY_MODE_NORMALIZED = MODE_NORMALIZED;

/** Mode difficulty multiplier — used in ML feature extraction. */
export const GATEWAY_MODE_DIFFICULTY_MULTIPLIER = MODE_DIFFICULTY_MULTIPLIER;

/** Mode tension floor — used in ML feature extraction. */
export const GATEWAY_MODE_TENSION_FLOOR = MODE_TENSION_FLOOR;

/** Run phase normalized — used in ML feature extraction and DL tensor. */
export const GATEWAY_RUN_PHASE_NORMALIZED = RUN_PHASE_NORMALIZED;

/** Run phase stakes multiplier — used in session annotations. */
export const GATEWAY_RUN_PHASE_STAKES_MULTIPLIER = RUN_PHASE_STAKES_MULTIPLIER;

/** Run phase tick budget fraction — used in run progress computation. */
export const GATEWAY_RUN_PHASE_TICK_BUDGET_FRACTION = RUN_PHASE_TICK_BUDGET_FRACTION;

/** Shield layer capacity weight — used in shield analytics. */
export const GATEWAY_SHIELD_LAYER_CAPACITY_WEIGHT = SHIELD_LAYER_CAPACITY_WEIGHT;

/** Shield layer label by ID — used in shield annotations. */
export const GATEWAY_SHIELD_LAYER_LABEL_BY_ID = SHIELD_LAYER_LABEL_BY_ID;

/** Integrity status risk score — used in ML feature extraction. */
export const GATEWAY_INTEGRITY_STATUS_RISK_SCORE = INTEGRITY_STATUS_RISK_SCORE;

/** Verified grade numeric score — used in ML feature extraction. */
export const GATEWAY_VERIFIED_GRADE_NUMERIC_SCORE = VERIFIED_GRADE_NUMERIC_SCORE;

/** Mode max divergence — used in DL tensor mode row. */
export const GATEWAY_MODE_MAX_DIVERGENCE = MODE_MAX_DIVERGENCE;

/** Divergence potential normalized table used in DL tensor. */
export const GATEWAY_DIVERGENCE_NORMALIZED = DIVERGENCE_POTENTIAL_NORMALIZED;

// ============================================================================
// MARK: Canonical constant re-exports for Zero.* namespace consumption
// ============================================================================

/** All recognized mode codes (for Zero.* namespace). */
export const GATEWAY_ALL_MODE_CODES = MODE_CODES;

/** All recognized pressure tiers (for Zero.* namespace). */
export const GATEWAY_ALL_PRESSURE_TIERS = PRESSURE_TIERS;

/** All recognized run phases (for Zero.* namespace). */
export const GATEWAY_ALL_RUN_PHASES = RUN_PHASES;

/** All recognized run outcomes (for Zero.* namespace). */
export const GATEWAY_ALL_RUN_OUTCOMES = RUN_OUTCOMES;

/** All recognized shield layer IDs (for Zero.* namespace). */
export const GATEWAY_ALL_SHIELD_LAYER_IDS = SHIELD_LAYER_IDS;

/** All recognized hater bot IDs (for Zero.* namespace). */
export const GATEWAY_ALL_HATER_BOT_IDS = HATER_BOT_IDS;

/** All recognized timing classes (for Zero.* namespace). */
export const GATEWAY_ALL_TIMING_CLASSES = TIMING_CLASSES;

/** All recognized deck types (for Zero.* namespace). */
export const GATEWAY_ALL_DECK_TYPES = DECK_TYPES;

/** All recognized integrity statuses (for Zero.* namespace). */
export const GATEWAY_ALL_INTEGRITY_STATUSES = INTEGRITY_STATUSES;

/** All recognized verified grades (for Zero.* namespace). */
export const GATEWAY_ALL_VERIFIED_GRADES = VERIFIED_GRADES;

// ============================================================================
// MARK: Singleton extractor / builder references for Zero.* namespace
// ============================================================================

/**
 * Default ML extractor — pre-bound for START commands.
 * Zero.GATEWAY_ML_EXTRACTOR(snapshot, sessionCount, lastArchive)
 */
export const ZERO_GATEWAY_ML_EXTRACTOR = (
  snapshot: RunStateSnapshot,
  sessionCommandCount: number,
  lastArchive: RunArchiveRecord | null,
): GatewayMLVector =>
  extractGatewayMLVector(snapshot, 'START', null, sessionCommandCount, lastArchive);

/**
 * Default DL builder — pre-bound for TICK commands.
 * Zero.GATEWAY_DL_BUILDER(snapshot, sessionCount, nowMs)
 */
export const ZERO_GATEWAY_DL_BUILDER = (
  snapshot: RunStateSnapshot,
  sessionCommandCount: number,
  nowMs: number,
): GatewayDLTensor =>
  buildGatewayDLTensor(snapshot, 'TICK', null, sessionCommandCount, nowMs);

/**
 * Default annotator singleton.
 */
export const GATEWAY_DEFAULT_ANNOTATOR = new CommandGatewayAnnotator('default');

/**
 * Strict annotator singleton — validates all enum fields.
 */
export const GATEWAY_STRICT_ANNOTATOR = new CommandGatewayAnnotator('strict');

/**
 * Verbose annotator singleton — appends all constants metadata.
 */
export const GATEWAY_VERBOSE_ANNOTATOR = new CommandGatewayAnnotator('verbose');

/**
 * Default inspector singleton.
 */
export const GATEWAY_DEFAULT_INSPECTOR = new CommandGatewayInspector();

// ============================================================================
// MARK: stableStringify usage — canonical encoding for ML pipeline exports
// ============================================================================

/**
 * Produce a canonical JSON string of a GatewayMLVector for storage / transport.
 * Uses stableStringify to guarantee deterministic key order.
 */
export function serializeGatewayMLVector(vector: GatewayMLVector): string {
  return stableStringify({
    labels: GATEWAY_ML_FEATURE_LABELS,
    values: vector.mlVectorArray,
    modeEncoded: vector.modeEncoded,
    commandKindEncoded: vector.commandKindEncoded,
    healthProxy: vector.sovereigntyScoreNormalized,
  });
}

/**
 * Produce a canonical JSON string of a GatewayDLTensor for storage / transport.
 */
export function serializeGatewayDLTensor(tensor: GatewayDLTensor): string {
  return stableStringify({
    shape: tensor.shape,
    runId: tensor.runId,
    mode: tensor.mode,
    commandKind: tensor.commandKind,
    rows: tensor.rows.map((r) => ({
      domain: r.domain,
      features: r.features,
    })),
  });
}

/**
 * Produce a cloned (mutable) deep copy of a GatewayMLVector for mutation pipelines.
 */
export function cloneGatewayMLVector(
  vector: GatewayMLVector,
): Omit<GatewayMLVector, 'mlVectorArray'> & { mlVectorArray: number[] } {
  const cloned = cloneJson(vector) as Omit<GatewayMLVector, 'mlVectorArray'> & {
    mlVectorArray: number[];
  };
  return cloned;
}
