/**
 * POINT ZERO ONE — IN-MEMORY RUN RUNTIME v3.0.0
 * backend/src/game/engine/run_runtime.ts
 *
 * Deterministic run lifecycle surface for replay tests, backend orchestration,
 * analytics, ML/DL feature extraction, proof generation, and chat bridge.
 *
 * Why this file exists:
 * - engine_determinism.test.ts imports createRun/finalizeRun/replayRun/submitTurnDecision
 * - the current public barrel does not provide a concrete runtime for those calls
 * - broken run orchestrator/finalizer files are excluded from build
 *
 * This runtime is intentionally:
 * - deterministic
 * - side-effect free
 * - in-memory
 * - test-friendly
 * - replay-engine backed
 * - mode-aware with full card_types doctrine integration
 * - ML/DL feature-extraction capable
 * - chat bridge enabled for lifecycle event translation
 */

import { createHash } from 'node:crypto';

import {
  DEFAULT_NON_ZERO_SEED,
  normalizeSeed,
  hashStringToSeed,
  combineSeed,
  createMulberry32,
  sanitizePositiveWeights,
  createDeterministicRng,
  type DeterministicRng,
} from './deterministic_rng';

import {
  ReplayEngine,
  GameState,
  createDefaultLedger,
  sha256Hex,
  stableStringify,
  type Seed,
  type DecisionEffect,
  type EffectTarget,
  type Ledger,
  type ReplaySnapshot,
  type RunCreatedEvent,
  type RunEvent,
  type RunFinalizedEvent,
  type TurnSubmittedEvent,
} from './replay_engine';

import {
  GameMode,
  DeckType,
  CardTag,
  CardRarity,
  TimingClass,
  PressureTier,
  RunPhase,
  GhostMarkerKind,
  DivergencePotential,
  TrustBand,
  type ModeCode,
  type CardDefinition,
  type CardEffectResult,
  type ResourceDelta,
  type CurrencyType,
  MODE_CODE_MAP,
  CARD_LEGALITY_MATRIX,
  MODE_TAG_WEIGHT_DEFAULTS,
  DECK_TYPE_PROFILES,
  MODE_CARD_BEHAVIORS,
  PRESSURE_COST_MODIFIERS,
  TRUST_SCORE_TIERS,
  GHOST_MARKER_SPECS,
  IPA_CHAIN_SYNERGIES,
  HOLD_SYSTEM_CONFIG,
  COMEBACK_SURGE_CONFIG,
  CARD_ML_FEATURE_DIMENSION,
  CARD_ML_FEATURE_LABELS,
  clamp,
  round6,
  computeTagWeightedScore,
  computeTrustEfficiency,
  computePressureCostModifier,
  computeBleedthroughMultiplier,
  generateCardPlayHash,
  computeDivergencePotential,
  isIPAChainComplete,
  getDeckTypeProfile,
  getModeCardBehavior,
} from './card_types';

// ─────────────────────────────────────────────────────────────────────────────
// RE-EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

export type { DecisionEffect, EffectTarget, Ledger, ReplaySnapshot, Seed };

// ─────────────────────────────────────────────────────────────────────────────
// VERSION & CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

export const RUN_RUNTIME_VERSION = '3.0.0';

/** Maximum number of turns a run can have before forced finalization. */
const MAX_TURNS_PER_RUN = 120;

/** Maximum number of effects allowed per turn submission. */
const MAX_EFFECTS_PER_TURN = 24;

/** Maximum runs stored in the in-memory store. */
const MAX_RUN_STORE_SIZE = 10_000;

/** Phase transition thresholds (turn-based). */
const PHASE_THRESHOLDS = {
  foundationEnd: 15,
  escalationEnd: 60,
} as const;

/** Sovereignty scoring weights for CORD computation. */
const CORD_SCORING_WEIGHTS = {
  cashWeight: 0.15,
  incomeWeight: 0.20,
  shieldWeight: 0.10,
  heatPenalty: 0.25,
  trustBonus: 0.15,
  divergenceBonus: 0.10,
  efficiencyWeight: 0.05,
} as const;

/** ML feature vector dimension for run-level features. */
const RUN_ML_FEATURE_DIM = 24;

/** DL tensor dimensions for turn-level deep learning input. */
const DL_TENSOR_ROWS = 40;
const DL_TENSOR_COLS = 8;

/** Proof artifact version tag. */
const PROOF_ARTIFACT_VERSION = 'pzo-proof-v3';

/** Default simulation tick count for strategy comparison. */
const DEFAULT_SIMULATION_TICKS = 60;

/** Chat bridge event type prefix. */
const CHAT_EVENT_PREFIX = 'pzo.run';

/** Grading thresholds for sovereignty score. */
const GRADE_THRESHOLDS = {
  S: 950,
  A: 800,
  B: 600,
  C: 400,
  D: 200,
} as const;

/** Pressure timeline sampling interval (every N turns). */
const PRESSURE_SAMPLE_INTERVAL = 3;

/** Ghost comparison alignment tolerance. */
const GHOST_ALIGNMENT_TOLERANCE = 0.05;

/** Velocity computation window size. */
const VELOCITY_WINDOW = 5;

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTED INTERFACES
// ─────────────────────────────────────────────────────────────────────────────

export interface SubmitTurnDecisionRequest {
  readonly turnIndex: number;
  readonly choiceId: string;
  readonly sourceCardInstanceId?: string;
  readonly effects: readonly DecisionEffect[];
}

export interface RunReplayResult {
  readonly runId: string;
  readonly replayHash: string;
  readonly replayBytesBase64: string;
  readonly snapshot: ReplaySnapshot;
}

export interface RunConfig {
  readonly mode: GameMode;
  readonly modeCode: ModeCode;
  readonly seed: number;
  readonly initialLedger: Partial<Ledger>;
  readonly maxTurns: number;
  readonly ghostSeed?: number;
  readonly teamSize?: number;
  readonly metadata?: Record<string, unknown>;
}

export interface RunDiagnostics {
  readonly runId: string;
  readonly seed: number;
  readonly turnCount: number;
  readonly finalized: boolean;
  readonly createdAt: number;
  readonly phase: RunPhase;
  readonly pressureTier: PressureTier;
  readonly trustBand: TrustBand;
  readonly ledgerSnapshot: Ledger;
  readonly eventCount: number;
  readonly decisionCount: number;
  readonly mode: GameMode;
  readonly runtimeVersion: string;
}

export interface PressureTimelineEntry {
  readonly turn: number;
  readonly pressureTier: PressureTier;
  readonly heat: number;
  readonly shield: number;
  readonly bleedthrough: number;
  readonly costModifier: number;
  readonly phase: RunPhase;
}

export interface TrustTimelineEntry {
  readonly turn: number;
  readonly trustScore: number;
  readonly trustBand: TrustBand;
  readonly efficiency: number;
  readonly loanAccessPct: number;
  readonly comboBonus: number;
}

export interface CardPlayAnalytics {
  readonly deckBreakdown: Record<string, number>;
  readonly rarityBreakdown: Record<string, number>;
  readonly tagFrequency: Record<string, number>;
  readonly totalCordContribution: number;
  readonly averageCordPerTurn: number;
  readonly deckDiversity: number;
  readonly ipaChainStatus: { complete: boolean; tier: string; synergyCount: number };
}

export interface SovereigntyGrade {
  readonly letter: string;
  readonly numericScore: number;
  readonly cordScore: number;
  readonly cashComponent: number;
  readonly incomeComponent: number;
  readonly shieldComponent: number;
  readonly heatPenaltyComponent: number;
  readonly trustBonusComponent: number;
  readonly divergenceBonusComponent: number;
  readonly efficiencyComponent: number;
  readonly phaseBonuses: Record<string, number>;
  readonly badgesEarned: string[];
}

export interface ProofArtifact {
  readonly version: string;
  readonly runId: string;
  readonly seed: number;
  readonly replayHash: string;
  readonly ledgerHash: string;
  readonly eventLogHash: string;
  readonly cordScore: number;
  readonly grade: string;
  readonly turnCount: number;
  readonly mode: GameMode;
  readonly timestamp: number;
  readonly deterministicSignature: string;
}

export interface RunMLFeatureVector {
  readonly features: readonly number[];
  readonly labels: readonly string[];
  readonly dimension: number;
}

export interface RunDLTensor {
  readonly data: readonly (readonly number[])[];
  readonly rows: number;
  readonly cols: number;
  readonly labels: readonly string[];
}

export interface AdvancedAnalytics {
  readonly velocities: Record<string, number[]>;
  readonly accelerations: Record<string, number[]>;
  readonly criticalTicks: number[];
  readonly momentumScore: number;
  readonly peakCash: number;
  readonly peakCashTurn: number;
  readonly troughCash: number;
  readonly troughCashTurn: number;
  readonly volatilityIndex: number;
  readonly recoveryCount: number;
}

export interface GhostComparisonResult {
  readonly ghostRunId: string;
  readonly playerRunId: string;
  readonly turnAlignments: readonly GhostTurnAlignment[];
  readonly totalDivergence: number;
  readonly averageDivergence: number;
  readonly maxDivergence: number;
  readonly markerExploits: number;
  readonly divergencePotential: string;
}

export interface GhostTurnAlignment {
  readonly turn: number;
  readonly ghostLedger: Ledger;
  readonly playerLedger: Ledger;
  readonly divergenceScore: number;
  readonly markerKind: GhostMarkerKind | null;
  readonly exploited: boolean;
}

export interface SimulationResult {
  readonly strategyName: string;
  readonly finalSnapshot: ReplaySnapshot;
  readonly cordScore: number;
  readonly grade: string;
  readonly turnCount: number;
}

export interface RunComparisonResult {
  readonly runs: readonly { runId: string; cordScore: number; grade: string }[];
  readonly bestRunId: string;
  readonly worstRunId: string;
  readonly averageCordScore: number;
  readonly cordStdDev: number;
}

export interface ChatBridgeEvent {
  readonly type: string;
  readonly runId: string;
  readonly timestamp: number;
  readonly payload: Record<string, unknown>;
}

export interface SeedAnalysis {
  readonly seed: number;
  readonly normalizedSeed: number;
  readonly seedHash: string;
  readonly derivedSubSeeds: Record<string, number>;
  readonly rngSample: number[];
  readonly entropyEstimate: number;
  readonly collisionRisk: string;
}

export interface DeterminismVerification {
  readonly verified: boolean;
  readonly replayHash1: string;
  readonly replayHash2: string;
  readonly snapshotMatch: boolean;
  readonly ledgerMatch: boolean;
  readonly turnCountMatch: boolean;
  readonly divergencePoint: number | null;
}

export interface RunExportPacket {
  readonly version: string;
  readonly runId: string;
  readonly seed: number;
  readonly mode: GameMode;
  readonly replayBytesBase64: string;
  readonly replayHash: string;
  readonly metadata: Record<string, unknown>;
  readonly exportedAt: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL DATA STORES
// ─────────────────────────────────────────────────────────────────────────────

interface RunRecord {
  readonly runId: string;
  readonly seed: number;
  readonly createdAt: number;
  readonly initialLedger: Ledger;
  readonly eventLog: readonly RunEvent[];
  readonly decisionCount: number;
  readonly finalized: boolean;
  readonly mode: GameMode;
  readonly maxTurns: number;
  readonly ghostSeed: number | null;
  readonly metadata: Record<string, unknown>;
}

interface RunMetadata {
  readonly configuredAt: number;
  readonly modeCode: ModeCode;
  readonly teamSize: number;
  readonly cardPlays: readonly CardPlayRecord[];
}

interface CardPlayRecord {
  readonly turnIndex: number;
  readonly choiceId: string;
  readonly deckType: DeckType;
  readonly rarity: CardRarity;
  readonly tags: readonly CardTag[];
  readonly cordDelta: number;
  readonly timingClass: TimingClass;
}

const runStore = new Map<string, RunRecord>();
const metadataStore = new Map<string, RunMetadata>();
const pressureTimelineCache = new Map<string, readonly PressureTimelineEntry[]>();
const trustTimelineCache = new Map<string, readonly TrustTimelineEntry[]>();
const analyticsCache = new Map<string, AdvancedAnalytics>();
const gradeCache = new Map<string, SovereigntyGrade>();
let runSequence = 0;

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

function buildRunId(seed: number, initialLedger: Ledger, sequence: number): string {
  const digest = sha256Hex(
    stableStringify({
      type: 'RUN',
      seed,
      sequence,
      initialLedger,
    }),
  );
  return `run_${digest.slice(0, 24)}`;
}

function buildDecisionId(
  runId: string,
  request: SubmitTurnDecisionRequest,
  decisionOrdinal: number,
): string {
  const digest = sha256Hex(
    stableStringify({
      type: 'DECISION',
      runId,
      decisionOrdinal,
      turnIndex: request.turnIndex,
      choiceId: request.choiceId,
      sourceCardInstanceId: request.sourceCardInstanceId ?? null,
      effects: request.effects,
    }),
  );
  return `decision_${digest.slice(0, 24)}`;
}

function getRunRecord(runId: string): RunRecord {
  const record = runStore.get(runId);
  if (!record) {
    throw new Error(`Unknown runId: ${runId}`);
  }
  return record;
}

function setRunRecord(record: RunRecord): void {
  if (runStore.size >= MAX_RUN_STORE_SIZE && !runStore.has(record.runId)) {
    const oldestKey = runStore.keys().next().value;
    if (oldestKey) {
      evictRunFromCaches(oldestKey);
      runStore.delete(oldestKey);
    }
  }
  runStore.set(record.runId, record);
}

function evictRunFromCaches(runId: string): void {
  metadataStore.delete(runId);
  pressureTimelineCache.delete(runId);
  trustTimelineCache.delete(runId);
  analyticsCache.delete(runId);
  gradeCache.delete(runId);
}

function buildReplayResult(record: RunRecord): RunReplayResult {
  const replayEngine = new ReplayEngine(record.seed, record.eventLog);
  const replayBytes = replayEngine.toReplayBytes();
  return {
    runId: record.runId,
    replayHash: replayEngine.getReplayHash(),
    replayBytesBase64: replayBytes.toString('base64'),
    snapshot: replayEngine.replayAll(),
  };
}

function validateEffects(effects: readonly DecisionEffect[]): void {
  if (!Array.isArray(effects)) {
    throw new Error('effects must be an array.');
  }
  if (effects.length > MAX_EFFECTS_PER_TURN) {
    throw new Error(`Too many effects: ${effects.length} exceeds max ${MAX_EFFECTS_PER_TURN}.`);
  }
  for (let i = 0; i < effects.length; i += 1) {
    const effect = effects[i];
    if (!effect || typeof effect !== 'object') {
      throw new Error(`effects[${i}] must be an object.`);
    }
    if (!Number.isFinite(effect.delta)) {
      throw new Error(`effects[${i}].delta must be a finite number.`);
    }
    validateEffectTarget(effect.target, i);
  }
}

function validateEffectTarget(target: EffectTarget, index: number): void {
  switch (target) {
    case 'cash':
    case 'income':
    case 'expenses':
    case 'shield':
    case 'heat':
    case 'trust':
    case 'divergence':
    case 'cords':
      break;
    default:
      throw new Error(`effects[${index}].target is invalid: ${String(target)}`);
  }
}

function effectTargetToLedgerKey(target: EffectTarget): keyof Ledger {
  switch (target) {
    case 'cash': return 'cash';
    case 'income': return 'income';
    case 'expenses': return 'expenses';
    case 'shield': return 'shield';
    case 'heat': return 'heat';
    case 'trust': return 'trust';
    case 'divergence': return 'divergence';
    case 'cords': return 'cords';
    default:
      return 'cash';
  }
}

function determinePressureTier(heat: number, shield: number): PressureTier {
  const netPressure = heat - shield * 0.01;
  if (netPressure <= 0.05) return PressureTier.T0_SOVEREIGN;
  if (netPressure <= 0.20) return PressureTier.T1_STABLE;
  if (netPressure <= 0.45) return PressureTier.T2_STRESSED;
  if (netPressure <= 0.75) return PressureTier.T3_ELEVATED;
  return PressureTier.T4_COLLAPSE_IMMINENT;
}

function determineRunPhase(turn: number): RunPhase {
  if (turn <= PHASE_THRESHOLDS.foundationEnd) return RunPhase.FOUNDATION;
  if (turn <= PHASE_THRESHOLDS.escalationEnd) return RunPhase.ESCALATION;
  return RunPhase.SOVEREIGNTY;
}

function determineTrustBand(trustScore: number): TrustBand {
  const result = computeTrustEfficiency(trustScore);
  return result.band;
}

function computeNetWorth(ledger: Ledger): number {
  return round6(ledger.cash + ledger.income * 10 - ledger.expenses * 10 + ledger.shield * 0.5);
}

function computeEfficiencyRatio(ledger: Ledger): number {
  const totalIncome = Math.max(ledger.income, 0.001);
  const totalExpenses = Math.max(ledger.expenses, 0.001);
  return round6(totalIncome / totalExpenses);
}

function computeSurvivalMargin(ledger: Ledger): number {
  const projectedCash = ledger.cash + ledger.income - ledger.expenses;
  return round6(Math.max(projectedCash, 0));
}

function computeHeatDecayRate(pressureTier: PressureTier): number {
  const costMod = computePressureCostModifier(pressureTier);
  return round6(0.02 / costMod);
}

function computeBleedForTurn(heat: number, shield: number, turn: number): number {
  const tier = determinePressureTier(heat, shield);
  const isCritical = turn === PHASE_THRESHOLDS.foundationEnd ||
    turn === PHASE_THRESHOLDS.escalationEnd;
  return computeBleedthroughMultiplier(tier, isCritical);
}

function computeLedgerDelta(before: Ledger, after: Ledger): Record<string, number> {
  return {
    cash: round6(after.cash - before.cash),
    income: round6(after.income - before.income),
    expenses: round6(after.expenses - before.expenses),
    shield: round6(after.shield - before.shield),
    heat: round6(after.heat - before.heat),
    trust: round6(after.trust - before.trust),
    divergence: round6(after.divergence - before.divergence),
    cords: round6(after.cords - before.cords),
  };
}

function computeTagWeightsForMode(mode: GameMode, tags: readonly CardTag[]): number {
  return computeTagWeightedScore(tags, mode);
}

function resolveGhostMarkerForTurn(
  turn: number,
  ghostSeed: number,
): GhostMarkerKind | null {
  const rng = createDeterministicRng(combineSeed(ghostSeed, turn));
  const roll = rng.next();
  if (roll < 0.15) return GhostMarkerKind.GOLD_BUY;
  if (roll < 0.30) return GhostMarkerKind.RED_PASS;
  if (roll < 0.42) return GhostMarkerKind.PURPLE_POWER;
  if (roll < 0.52) return GhostMarkerKind.SILVER_BREACH;
  if (roll < 0.58) return GhostMarkerKind.BLACK_CASCADE;
  return null;
}

function computeGhostMarkerCordBonus(kind: GhostMarkerKind): number {
  const spec = GHOST_MARKER_SPECS[kind];
  return spec.cordBonus;
}

function computeGhostMarkerShieldBonus(kind: GhostMarkerKind): number {
  const spec = GHOST_MARKER_SPECS[kind];
  return spec.shieldBonus;
}

function buildLedgerTimeline(record: RunRecord): Ledger[] {
  const ledgers: Ledger[] = [];
  const state = new GameState(record.seed);
  for (const event of record.eventLog) {
    state.applyEvent(event);
    if (event.type === 'TURN_SUBMITTED') {
      ledgers.push(state.snapshot().ledger);
    }
  }
  return ledgers;
}

function computeVelocity(values: number[], windowSize: number): number[] {
  const velocities: number[] = [];
  for (let i = windowSize; i < values.length; i++) {
    const delta = values[i] - values[i - windowSize];
    velocities.push(round6(delta / windowSize));
  }
  return velocities;
}

function computeAcceleration(velocities: number[]): number[] {
  const accel: number[] = [];
  for (let i = 1; i < velocities.length; i++) {
    accel.push(round6(velocities[i] - velocities[i - 1]));
  }
  return accel;
}

function findCriticalTicks(ledgerTimeline: Ledger[]): number[] {
  const critical: number[] = [];
  for (let i = 1; i < ledgerTimeline.length; i++) {
    const prev = ledgerTimeline[i - 1];
    const curr = ledgerTimeline[i];
    const cashDrop = prev.cash - curr.cash;
    const heatSpike = curr.heat - prev.heat;
    if (cashDrop > prev.cash * 0.2 || heatSpike > 0.15) {
      critical.push(i);
    }
    if (i === PHASE_THRESHOLDS.foundationEnd || i === PHASE_THRESHOLDS.escalationEnd) {
      critical.push(i);
    }
  }
  return [...new Set(critical)].sort((a, b) => a - b);
}

function computeMomentumScore(ledgerTimeline: Ledger[]): number {
  if (ledgerTimeline.length < 3) return 0;
  let momentum = 0;
  for (let i = 1; i < ledgerTimeline.length; i++) {
    const prev = ledgerTimeline[i - 1];
    const curr = ledgerTimeline[i];
    const cashDelta = curr.cash - prev.cash;
    const incomeDelta = curr.income - prev.income;
    const cordsDelta = curr.cords - prev.cords;
    if (cashDelta > 0) momentum += 1;
    if (incomeDelta > 0) momentum += 0.5;
    if (cordsDelta > 0) momentum += 1.5;
    if (curr.heat < prev.heat) momentum += 0.3;
  }
  return round6(momentum / (ledgerTimeline.length - 1));
}

function computeVolatilityIndex(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return round6(Math.sqrt(variance));
}

function countRecoveries(cashValues: number[]): number {
  let recoveries = 0;
  let inDip = false;
  let dipStart = 0;
  for (let i = 1; i < cashValues.length; i++) {
    if (!inDip && cashValues[i] < cashValues[i - 1] * 0.85) {
      inDip = true;
      dipStart = cashValues[i - 1];
    } else if (inDip && cashValues[i] >= dipStart * 0.95) {
      recoveries += 1;
      inDip = false;
    }
  }
  return recoveries;
}

function buildEffectTargetMap(): Map<EffectTarget, string> {
  const map = new Map<EffectTarget, string>();
  const targets: EffectTarget[] = ['cash', 'income', 'expenses', 'shield', 'heat', 'trust', 'divergence', 'cords'];
  for (const t of targets) {
    map.set(t, effectTargetToLedgerKey(t));
  }
  return map;
}

function computeLightweightHash(input: string, seed: number): string {
  const mulberry = createMulberry32(seed);
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash + input.charCodeAt(i) * (mulberry() * 0xFFFFFFFF >>> 0)) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function pickWeightedDeckType(
  mode: GameMode,
  rng: DeterministicRng,
): DeckType {
  const legalDecks = CARD_LEGALITY_MATRIX[mode];
  const rawWeights = legalDecks.map(dt => {
    const profile = getDeckTypeProfile(dt);
    return profile.drawRateMultiplier;
  });
  const weights = sanitizePositiveWeights(rawWeights);
  const idx = rng.pickIndexByWeights(weights);
  return legalDecks[idx];
}

function pickWeightedRarityForDeck(
  deckType: DeckType,
  rng: DeterministicRng,
): CardRarity {
  const profile = getDeckTypeProfile(deckType);
  const baseWeights = [
    0.55 * profile.drawRateMultiplier,
    0.28 * profile.drawRateMultiplier,
    0.13,
    0.04,
  ];
  const weights = sanitizePositiveWeights(baseWeights);
  const idx = rng.pickIndexByWeights(weights);
  const rarities = [CardRarity.COMMON, CardRarity.UNCOMMON, CardRarity.RARE, CardRarity.LEGENDARY];
  return rarities[idx];
}

function pickTagsForDeck(
  deckType: DeckType,
  mode: GameMode,
  rng: DeterministicRng,
): CardTag[] {
  const allTags = Object.values(CardTag);
  const modeWeights = MODE_TAG_WEIGHT_DEFAULTS[mode];
  const rawWeights = allTags.map(tag => Math.max(modeWeights[tag] ?? 0, 0.01));
  const weights = sanitizePositiveWeights(rawWeights);

  const tagCount = 1 + rng.nextInt(3);
  const chosen: CardTag[] = [];
  for (let i = 0; i < tagCount && i < allTags.length; i++) {
    const idx = rng.pickIndexByWeights(weights);
    const tag = allTags[idx];
    if (!chosen.includes(tag)) {
      chosen.push(tag);
    }
  }

  void deckType;
  return chosen;
}

function pickTimingClassForMode(
  mode: GameMode,
  rng: DeterministicRng,
): TimingClass {
  const behavior = getModeCardBehavior(mode);
  const allTimings = Object.values(TimingClass);
  const validTimings = allTimings.filter(tc => {
    if (tc === TimingClass.CTR && !behavior.counterWindowEnabled) return false;
    if (tc === TimingClass.AID && !behavior.aidWindowEnabled) return false;
    if (tc === TimingClass.GBM && !behavior.ghostEnabled) return false;
    if (tc === TimingClass.RES && !behavior.rescueEnabled) return false;
    return true;
  });
  const idx = rng.nextInt(validTimings.length);
  return validTimings[idx];
}

function resolveModeFromCode(modeCode: ModeCode): GameMode {
  return MODE_CODE_MAP[modeCode];
}

function buildDefaultMetadata(mode: GameMode): Record<string, unknown> {
  const behavior = getModeCardBehavior(mode);
  return {
    runtimeVersion: RUN_RUNTIME_VERSION,
    holdEnabled: behavior.holdEnabled,
    battleBudgetEnabled: behavior.battleBudgetEnabled,
    trustEnabled: behavior.trustEnabled,
    ghostEnabled: behavior.ghostEnabled,
    defaultChannel: behavior.defaultChannel,
    stageMood: behavior.stageMood,
  };
}

function validateModeConsistency(mode: GameMode, ledger: Ledger): string[] {
  const warnings: string[] = [];
  const behavior = getModeCardBehavior(mode);

  if (!behavior.trustEnabled && ledger.trust !== 50 && ledger.trust !== 0) {
    warnings.push(`Trust score ${ledger.trust} is non-default for mode ${mode} which does not use trust.`);
  }

  if (behavior.battleBudgetEnabled && ledger.cash < 0) {
    warnings.push(`Negative cash in PvP mode may indicate battle budget accounting error.`);
  }

  if (mode === GameMode.CHASE_A_LEGEND && ledger.divergence === 0) {
    warnings.push(`Ghost mode run has zero divergence — verify ghost seed is configured.`);
  }

  return warnings;
}

function computeIpaChainForPlays(plays: readonly CardPlayRecord[]): {
  complete: boolean;
  tier: string;
  synergyCount: number;
} {
  const deckTypesPlayed = [...new Set(plays.map(p => p.deckType))];
  const result = isIPAChainComplete(deckTypesPlayed);
  return {
    complete: result.complete,
    tier: result.tier,
    synergyCount: result.synergies.length,
  };
}

function computeDeckDiversity(plays: readonly CardPlayRecord[]): number {
  if (plays.length === 0) return 0;
  const uniqueDecks = new Set(plays.map(p => p.deckType));
  const totalDeckTypes = Object.keys(DeckType).length;
  return round6(uniqueDecks.size / totalDeckTypes);
}

function computeCardPlayTagFrequency(plays: readonly CardPlayRecord[]): Record<string, number> {
  const freq: Record<string, number> = {};
  for (const tag of Object.values(CardTag)) {
    freq[tag] = 0;
  }
  for (const play of plays) {
    for (const tag of play.tags) {
      freq[tag] = (freq[tag] ?? 0) + 1;
    }
  }
  return freq;
}

function computeDeckBreakdown(plays: readonly CardPlayRecord[]): Record<string, number> {
  const breakdown: Record<string, number> = {};
  for (const dt of Object.values(DeckType)) {
    breakdown[dt] = 0;
  }
  for (const play of plays) {
    breakdown[play.deckType] = (breakdown[play.deckType] ?? 0) + 1;
  }
  return breakdown;
}

function computeRarityBreakdown(plays: readonly CardPlayRecord[]): Record<string, number> {
  const breakdown: Record<string, number> = {};
  for (const r of Object.values(CardRarity)) {
    breakdown[r] = 0;
  }
  for (const play of plays) {
    breakdown[play.rarity] = (breakdown[play.rarity] ?? 0) + 1;
  }
  return breakdown;
}

function computeCordScoreForLedger(
  ledger: Ledger,
  turn: number,
  mode: GameMode,
): number {
  const phase = determineRunPhase(turn);
  const pressureTier = determinePressureTier(ledger.heat, ledger.shield);

  const cashComponent = Math.max(ledger.cash, 0) * CORD_SCORING_WEIGHTS.cashWeight;
  const incomeComponent = Math.max(ledger.income, 0) * CORD_SCORING_WEIGHTS.incomeWeight * 10;
  const shieldComponent = Math.max(ledger.shield, 0) * CORD_SCORING_WEIGHTS.shieldWeight;
  const heatPenalty = Math.max(ledger.heat, 0) * CORD_SCORING_WEIGHTS.heatPenalty * 500;
  const efficiency = computeEfficiencyRatio(ledger);
  const efficiencyComponent = efficiency * CORD_SCORING_WEIGHTS.efficiencyWeight * 100;

  let trustBonusComponent = 0;
  if (mode === GameMode.TEAM_UP) {
    const trustResult = computeTrustEfficiency(ledger.trust);
    trustBonusComponent = trustResult.efficiency * CORD_SCORING_WEIGHTS.trustBonus * 100;
  }

  let divergenceBonusComponent = 0;
  if (mode === GameMode.CHASE_A_LEGEND) {
    divergenceBonusComponent = Math.max(ledger.divergence, 0) * CORD_SCORING_WEIGHTS.divergenceBonus * 10;
  }

  let phaseMultiplier = 1.0;
  switch (phase) {
    case RunPhase.FOUNDATION: phaseMultiplier = 0.8; break;
    case RunPhase.ESCALATION: phaseMultiplier = 1.0; break;
    case RunPhase.SOVEREIGNTY: phaseMultiplier = 1.3; break;
  }

  const pressureCostMod = computePressureCostModifier(pressureTier);
  const pressureBonus = pressureTier === PressureTier.T0_SOVEREIGN ? 50 : 0;

  const raw = (cashComponent + incomeComponent + shieldComponent + efficiencyComponent +
    trustBonusComponent + divergenceBonusComponent + pressureBonus - heatPenalty) *
    phaseMultiplier / Math.max(pressureCostMod, 0.5);

  return round6(Math.max(raw + ledger.cords, 0));
}

function letterGradeFromScore(score: number): string {
  if (score >= GRADE_THRESHOLDS.S) return 'S';
  if (score >= GRADE_THRESHOLDS.A) return 'A';
  if (score >= GRADE_THRESHOLDS.B) return 'B';
  if (score >= GRADE_THRESHOLDS.C) return 'C';
  if (score >= GRADE_THRESHOLDS.D) return 'D';
  return 'F';
}

function computePhaseBonuses(
  ledgerTimeline: Ledger[],
  mode: GameMode,
): Record<string, number> {
  const bonuses: Record<string, number> = {
    [RunPhase.FOUNDATION]: 0,
    [RunPhase.ESCALATION]: 0,
    [RunPhase.SOVEREIGNTY]: 0,
  };

  if (ledgerTimeline.length > PHASE_THRESHOLDS.foundationEnd) {
    const foundationEnd = ledgerTimeline[PHASE_THRESHOLDS.foundationEnd];
    if (foundationEnd.cash > 0 && foundationEnd.income > 0) {
      bonuses[RunPhase.FOUNDATION] = 25;
    }
  }

  if (ledgerTimeline.length > PHASE_THRESHOLDS.escalationEnd) {
    const escalationEnd = ledgerTimeline[PHASE_THRESHOLDS.escalationEnd];
    if (escalationEnd.shield > 20 && escalationEnd.heat < 0.3) {
      bonuses[RunPhase.ESCALATION] = 50;
    }
  }

  if (ledgerTimeline.length > PHASE_THRESHOLDS.escalationEnd + 1) {
    const final = ledgerTimeline[ledgerTimeline.length - 1];
    const tier = determinePressureTier(final.heat, final.shield);
    if (tier === PressureTier.T0_SOVEREIGN) {
      bonuses[RunPhase.SOVEREIGNTY] = 100;
    }
    if (mode === GameMode.TEAM_UP) {
      const trustResult = computeTrustEfficiency(final.trust);
      if (trustResult.band === TrustBand.SOVEREIGN_TRUST) {
        bonuses[RunPhase.SOVEREIGNTY] += 50;
      }
    }
  }

  return bonuses;
}

function computeBadgesEarned(
  ledger: Ledger,
  turn: number,
  mode: GameMode,
  plays: readonly CardPlayRecord[],
): string[] {
  const badges: string[] = [];
  const phase = determineRunPhase(turn);
  const behavior = getModeCardBehavior(mode);

  if (phase === RunPhase.SOVEREIGNTY && ledger.cash > 0 && ledger.income > 0 &&
    mode === GameMode.GO_ALONE) {
    badges.push('sovereign_builder');
  }

  if (ledger.heat <= 0.01) {
    badges.push('zero_heat_finish');
  }

  if (mode === GameMode.TEAM_UP) {
    const trustResult = computeTrustEfficiency(ledger.trust);
    if (trustResult.band === TrustBand.SOVEREIGN_TRUST) {
      badges.push('trust_keeper');
    }
  }

  if (mode === GameMode.GO_ALONE && behavior.holdEnabled) {
    const hasHoldPlay = false;
    if (!hasHoldPlay) {
      badges.push('no_hold_warrior');
    }
  }

  const ipaStatus = computeIpaChainForPlays(plays);
  if (ipaStatus.complete) {
    badges.push('ipa_chain_master');
  }

  if (mode === GameMode.CHASE_A_LEGEND && ledger.divergence > 50) {
    badges.push('divergence_king');
  }

  return badges;
}

function computeDivergencePotentialForTurn(
  turn: number,
  deckType: DeckType,
  timingClass: TimingClass,
  ghostSeed: number | null,
): string {
  const mockDef = {
    cardId: `sim_${deckType}_${turn}`,
    name: `Simulated ${deckType}`,
    deckType,
    baseCost: 0,
    effects: [],
    tags: [],
    timingClasses: [timingClass],
    rarity: CardRarity.COMMON,
    autoResolve: false,
    counterability: 'NONE' as any,
    targeting: 'SELF' as any,
  } as CardDefinition;

  const tickDistance = ghostSeed ? (turn % 5) : 999;
  const result = computeDivergencePotential(mockDef, timingClass, tickDistance);
  return result;
}

function buildChatEventType(action: string): string {
  return `${CHAT_EVENT_PREFIX}.${action}`;
}

function generateDeterministicSignature(
  runId: string,
  seed: number,
  replayHash: string,
): string {
  const payload = stableStringify({ runId, seed, replayHash, version: PROOF_ARTIFACT_VERSION });
  return sha256Hex(payload);
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST RESET
// ─────────────────────────────────────────────────────────────────────────────

export function __resetEngineStateForTests(): void {
  runStore.clear();
  metadataStore.clear();
  pressureTimelineCache.clear();
  trustTimelineCache.clear();
  analyticsCache.clear();
  gradeCache.clear();
  runSequence = 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

export async function createRun(
  seed: number,
  initialLedger: Ledger,
): Promise<string> {
  const normalizedSeed = normalizeSeed(seed);
  const ledger = createDefaultLedger(initialLedger);
  const sequence = runSequence;
  const runId = buildRunId(normalizedSeed, ledger, sequence);
  const createdAt = sequence * 1000 + normalizedSeed;

  const createdEvent: RunCreatedEvent = {
    type: 'RUN_CREATED',
    runId,
    seed: normalizedSeed,
    createdAt,
    ledger,
  };

  const record: RunRecord = {
    runId,
    seed: normalizedSeed,
    createdAt,
    initialLedger: ledger,
    eventLog: [createdEvent],
    decisionCount: 0,
    finalized: false,
    mode: GameMode.GO_ALONE,
    maxTurns: MAX_TURNS_PER_RUN,
    ghostSeed: null,
    metadata: buildDefaultMetadata(GameMode.GO_ALONE),
  };

  setRunRecord(record);
  runSequence += 1;
  return runId;
}

export async function submitTurnDecision(
  runId: string,
  request: SubmitTurnDecisionRequest,
): Promise<void> {
  const record = getRunRecord(runId);

  if (record.finalized) {
    throw new Error(`Run ${runId} is already finalized.`);
  }

  if (record.decisionCount >= record.maxTurns) {
    throw new Error(`Run ${runId} has reached max turns (${record.maxTurns}).`);
  }

  if (!Number.isInteger(request.turnIndex) || request.turnIndex < 0) {
    throw new Error(`turnIndex must be a non-negative integer. Received: ${String(request.turnIndex)}`);
  }

  if (request.turnIndex !== record.decisionCount) {
    throw new Error(
      `Out-of-order turn submission for run ${runId}. Expected turnIndex ${record.decisionCount}, received ${request.turnIndex}.`,
    );
  }

  if (typeof request.choiceId !== 'string' || request.choiceId.trim().length === 0) {
    throw new Error('choiceId must be a non-empty string.');
  }

  if (
    request.sourceCardInstanceId !== undefined &&
    (typeof request.sourceCardInstanceId !== 'string' ||
      request.sourceCardInstanceId.trim().length === 0)
  ) {
    throw new Error('sourceCardInstanceId, when provided, must be a non-empty string.');
  }

  validateEffects(request.effects);

  const decisionId = buildDecisionId(runId, request, record.decisionCount);
  const submittedAt = record.createdAt + record.decisionCount + 1;

  const baseEvent: Omit<TurnSubmittedEvent, 'sourceCardInstanceId'> = {
    type: 'TURN_SUBMITTED',
    runId,
    turnIndex: request.turnIndex,
    decisionId,
    choiceId: request.choiceId,
    submittedAt,
    effects: [...request.effects],
  };

  const turnEvent: TurnSubmittedEvent =
    request.sourceCardInstanceId === undefined
      ? baseEvent
      : {
          ...baseEvent,
          sourceCardInstanceId: request.sourceCardInstanceId,
        };

  setRunRecord({
    ...record,
    eventLog: [...record.eventLog, turnEvent],
    decisionCount: record.decisionCount + 1,
  });

  // Invalidate caches for this run
  pressureTimelineCache.delete(runId);
  trustTimelineCache.delete(runId);
  analyticsCache.delete(runId);
  gradeCache.delete(runId);
}

export async function finalizeRun(runId: string): Promise<RunReplayResult> {
  const record = getRunRecord(runId);

  if (!record.finalized) {
    const finalizedAt = record.createdAt + record.decisionCount + 1;

    const finalizedEvent: RunFinalizedEvent = {
      type: 'RUN_FINALIZED',
      runId,
      finalizedAt,
    };

    const updatedRecord: RunRecord = {
      ...record,
      finalized: true,
      eventLog: [...record.eventLog, finalizedEvent],
    };

    setRunRecord(updatedRecord);
    return buildReplayResult(updatedRecord);
  }

  return buildReplayResult(record);
}

export async function replayRun(runId: string): Promise<RunReplayResult> {
  return buildReplayResult(getRunRecord(runId));
}

// ─────────────────────────────────────────────────────────────────────────────
// MODE-AWARE RUN CREATION
// ─────────────────────────────────────────────────────────────────────────────

export async function createRunWithConfig(config: RunConfig): Promise<string> {
  const resolvedMode = config.mode ?? resolveModeFromCode(config.modeCode);
  const normalizedSeed = normalizeSeed(config.seed);
  const ledger = createDefaultLedger(config.initialLedger);
  const sequence = runSequence;
  const runId = buildRunId(normalizedSeed, ledger, sequence);
  const createdAt = sequence * 1000 + normalizedSeed;

  const createdEvent: RunCreatedEvent = {
    type: 'RUN_CREATED',
    runId,
    seed: normalizedSeed,
    createdAt,
    ledger,
  };

  const ghostSeed = config.ghostSeed
    ? normalizeSeed(config.ghostSeed)
    : (resolvedMode === GameMode.CHASE_A_LEGEND ? combineSeed(normalizedSeed, 'ghost') : null);

  const record: RunRecord = {
    runId,
    seed: normalizedSeed,
    createdAt,
    initialLedger: ledger,
    eventLog: [createdEvent],
    decisionCount: 0,
    finalized: false,
    mode: resolvedMode,
    maxTurns: Math.min(config.maxTurns ?? MAX_TURNS_PER_RUN, MAX_TURNS_PER_RUN),
    ghostSeed: ghostSeed ?? null,
    metadata: {
      ...buildDefaultMetadata(resolvedMode),
      ...config.metadata,
    },
  };

  setRunRecord(record);

  const meta: RunMetadata = {
    configuredAt: createdAt,
    modeCode: config.modeCode,
    teamSize: config.teamSize ?? 1,
    cardPlays: [],
  };
  metadataStore.set(runId, meta);

  runSequence += 1;
  return runId;
}

export async function createRunBatch(
  configs: readonly RunConfig[],
): Promise<string[]> {
  const runIds: string[] = [];
  for (const config of configs) {
    const runId = await createRunWithConfig(config);
    runIds.push(runId);
  }
  return runIds;
}

// ─────────────────────────────────────────────────────────────────────────────
// RUN STATE QUERIES
// ─────────────────────────────────────────────────────────────────────────────

export function getRunState(runId: string): ReplaySnapshot {
  const record = getRunRecord(runId);
  const engine = new ReplayEngine(record.seed, record.eventLog);
  return engine.replayAll();
}

export function getRunDiagnostics(runId: string): RunDiagnostics {
  const record = getRunRecord(runId);
  const snapshot = getRunState(runId);
  const ledger = snapshot.ledger;
  const phase = determineRunPhase(ledger.turn);
  const pressureTier = determinePressureTier(ledger.heat, ledger.shield);
  const trustBand = determineTrustBand(ledger.trust);

  return {
    runId: record.runId,
    seed: record.seed,
    turnCount: snapshot.turnCount,
    finalized: snapshot.finalized,
    createdAt: record.createdAt,
    phase,
    pressureTier,
    trustBand,
    ledgerSnapshot: ledger,
    eventCount: record.eventLog.length,
    decisionCount: record.decisionCount,
    mode: record.mode,
    runtimeVersion: RUN_RUNTIME_VERSION,
  };
}

export function getRunPhase(runId: string): RunPhase {
  const snapshot = getRunState(runId);
  return determineRunPhase(snapshot.ledger.turn);
}

export function getRunPressureTier(runId: string): PressureTier {
  const snapshot = getRunState(runId);
  return determinePressureTier(snapshot.ledger.heat, snapshot.ledger.shield);
}

export function isPhaseTransition(runId: string): { transitioning: boolean; from: RunPhase; to: RunPhase } {
  const snapshot = getRunState(runId);
  const turn = snapshot.ledger.turn;
  const currentPhase = determineRunPhase(turn);
  const previousPhase = turn > 0 ? determineRunPhase(turn - 1) : currentPhase;

  return {
    transitioning: currentPhase !== previousPhase,
    from: previousPhase,
    to: currentPhase,
  };
}

export function getRunModeConsistencyWarnings(runId: string): string[] {
  const record = getRunRecord(runId);
  const snapshot = getRunState(runId);
  return validateModeConsistency(record.mode, snapshot.ledger);
}

// ─────────────────────────────────────────────────────────────────────────────
// PRESSURE & TRUST TIMELINES
// ─────────────────────────────────────────────────────────────────────────────

export function computePressureTimeline(runId: string): readonly PressureTimelineEntry[] {
  const cached = pressureTimelineCache.get(runId);
  if (cached) return cached;

  const record = getRunRecord(runId);
  const ledgerTimeline = buildLedgerTimeline(record);
  const entries: PressureTimelineEntry[] = [];

  for (let t = 0; t < ledgerTimeline.length; t += 1) {
    if (t % PRESSURE_SAMPLE_INTERVAL !== 0 && t !== ledgerTimeline.length - 1) continue;

    const ledger = ledgerTimeline[t];
    const pressureTier = determinePressureTier(ledger.heat, ledger.shield);
    const costModifier = computePressureCostModifier(pressureTier);
    const bleedthrough = computeBleedForTurn(ledger.heat, ledger.shield, t);
    const phase = determineRunPhase(t);

    entries.push({
      turn: t,
      pressureTier,
      heat: ledger.heat,
      shield: ledger.shield,
      bleedthrough,
      costModifier,
      phase,
    });
  }

  pressureTimelineCache.set(runId, entries);
  return entries;
}

export function computeTrustTimeline(runId: string): readonly TrustTimelineEntry[] {
  const cached = trustTimelineCache.get(runId);
  if (cached) return cached;

  const record = getRunRecord(runId);
  const ledgerTimeline = buildLedgerTimeline(record);
  const entries: TrustTimelineEntry[] = [];

  for (let t = 0; t < ledgerTimeline.length; t += 1) {
    const ledger = ledgerTimeline[t];
    const trustResult = computeTrustEfficiency(ledger.trust);

    entries.push({
      turn: t,
      trustScore: ledger.trust,
      trustBand: trustResult.band,
      efficiency: trustResult.efficiency,
      loanAccessPct: trustResult.loanAccessPct,
      comboBonus: trustResult.comboBonus,
    });
  }

  trustTimelineCache.set(runId, entries);
  return entries;
}

export function analyzePressureDeepDive(runId: string): {
  averagePressureTier: number;
  peakHeat: number;
  peakHeatTurn: number;
  totalBleedthrough: number;
  phasePressureBreakdown: Record<string, { avgHeat: number; avgShield: number }>;
  timeInEachTier: Record<string, number>;
  heatDecayRate: number;
} {
  const timeline = computePressureTimeline(runId);
  let totalTierOrd = 0;
  let peakHeat = 0;
  let peakHeatTurn = 0;
  let totalBleed = 0;
  const tierTimes: Record<string, number> = {};
  const phaseAccum: Record<string, { heatSum: number; shieldSum: number; count: number }> = {};

  for (const tier of Object.values(PressureTier)) {
    tierTimes[tier] = 0;
  }
  for (const phase of Object.values(RunPhase)) {
    phaseAccum[phase] = { heatSum: 0, shieldSum: 0, count: 0 };
  }

  for (const entry of timeline) {
    const tierValues: Record<string, number> = {
      [PressureTier.T0_SOVEREIGN]: 0,
      [PressureTier.T1_STABLE]: 1,
      [PressureTier.T2_STRESSED]: 2,
      [PressureTier.T3_ELEVATED]: 3,
      [PressureTier.T4_COLLAPSE_IMMINENT]: 4,
    };
    totalTierOrd += tierValues[entry.pressureTier] ?? 0;

    if (entry.heat > peakHeat) {
      peakHeat = entry.heat;
      peakHeatTurn = entry.turn;
    }

    totalBleed += entry.bleedthrough;
    tierTimes[entry.pressureTier] = (tierTimes[entry.pressureTier] ?? 0) + PRESSURE_SAMPLE_INTERVAL;

    const pa = phaseAccum[entry.phase];
    if (pa) {
      pa.heatSum += entry.heat;
      pa.shieldSum += entry.shield;
      pa.count += 1;
    }
  }

  const count = Math.max(timeline.length, 1);
  const avgTierOrd = round6(totalTierOrd / count);
  const phasePressure: Record<string, { avgHeat: number; avgShield: number }> = {};
  for (const [phase, acc] of Object.entries(phaseAccum)) {
    const c = Math.max(acc.count, 1);
    phasePressure[phase] = {
      avgHeat: round6(acc.heatSum / c),
      avgShield: round6(acc.shieldSum / c),
    };
  }

  const lastTier = timeline.length > 0
    ? determinePressureTier(timeline[timeline.length - 1].heat, timeline[timeline.length - 1].shield)
    : PressureTier.T1_STABLE;

  return {
    averagePressureTier: avgTierOrd,
    peakHeat: round6(peakHeat),
    peakHeatTurn,
    totalBleedthrough: round6(totalBleed),
    phasePressureBreakdown: phasePressure,
    timeInEachTier: tierTimes,
    heatDecayRate: computeHeatDecayRate(lastTier),
  };
}

export function analyzeTrustDeepDive(runId: string): {
  averageTrust: number;
  minTrust: number;
  minTrustTurn: number;
  maxTrust: number;
  maxTrustTurn: number;
  bandTransitions: number;
  timeInEachBand: Record<string, number>;
  trustEfficiencyOverTime: number[];
} {
  const timeline = computeTrustTimeline(runId);
  let totalTrust = 0;
  let minTrust = 100;
  let minTrustTurn = 0;
  let maxTrust = 0;
  let maxTrustTurn = 0;
  let transitions = 0;
  let prevBand: TrustBand | null = null;
  const bandTimes: Record<string, number> = {};
  const efficiencyOverTime: number[] = [];

  for (const band of Object.values(TrustBand)) {
    bandTimes[band] = 0;
  }

  for (const entry of timeline) {
    totalTrust += entry.trustScore;
    efficiencyOverTime.push(entry.efficiency);

    if (entry.trustScore < minTrust) {
      minTrust = entry.trustScore;
      minTrustTurn = entry.turn;
    }
    if (entry.trustScore > maxTrust) {
      maxTrust = entry.trustScore;
      maxTrustTurn = entry.turn;
    }

    bandTimes[entry.trustBand] = (bandTimes[entry.trustBand] ?? 0) + 1;

    if (prevBand && prevBand !== entry.trustBand) {
      transitions += 1;
    }
    prevBand = entry.trustBand;
  }

  const count = Math.max(timeline.length, 1);

  return {
    averageTrust: round6(totalTrust / count),
    minTrust: round6(minTrust),
    minTrustTurn,
    maxTrust: round6(maxTrust),
    maxTrustTurn,
    bandTransitions: transitions,
    timeInEachBand: bandTimes,
    trustEfficiencyOverTime: efficiencyOverTime,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CARD PLAY ANALYTICS
// ─────────────────────────────────────────────────────────────────────────────

export function registerCardPlay(
  runId: string,
  turnIndex: number,
  choiceId: string,
  deckType: DeckType,
  rarity: CardRarity,
  tags: readonly CardTag[],
  cordDelta: number,
  timingClass: TimingClass,
): void {
  const meta = metadataStore.get(runId);
  if (!meta) return;

  const play: CardPlayRecord = {
    turnIndex,
    choiceId,
    deckType,
    rarity,
    tags: [...tags],
    cordDelta,
    timingClass,
  };

  metadataStore.set(runId, {
    ...meta,
    cardPlays: [...meta.cardPlays, play],
  });
}

export function getCardPlayAnalytics(runId: string): CardPlayAnalytics {
  const meta = metadataStore.get(runId);
  const plays = meta?.cardPlays ?? [];
  const record = getRunRecord(runId);

  const deckBreakdown = computeDeckBreakdown(plays);
  const rarityBreakdown = computeRarityBreakdown(plays);
  const tagFrequency = computeCardPlayTagFrequency(plays);

  let totalCord = 0;
  for (const play of plays) {
    totalCord += play.cordDelta;
  }

  const ipaStatus = computeIpaChainForPlays(plays);
  const deckDiversity = computeDeckDiversity(plays);
  const turnCount = Math.max(record.decisionCount, 1);

  return {
    deckBreakdown,
    rarityBreakdown,
    tagFrequency,
    totalCordContribution: round6(totalCord),
    averageCordPerTurn: round6(totalCord / turnCount),
    deckDiversity,
    ipaChainStatus: ipaStatus,
  };
}

export function computeCardPlayHash(
  runId: string,
  cardId: string,
  choiceId: string,
  turnIndex: number,
): string {
  const record = getRunRecord(runId);
  return generateCardPlayHash(
    `${runId}_${turnIndex}`,
    cardId,
    record.mode,
    turnIndex,
    choiceId,
    String(record.seed),
  );
}

export function computeModeSpecificTagScore(
  runId: string,
  tags: readonly CardTag[],
): number {
  const record = getRunRecord(runId);
  return computeTagWeightsForMode(record.mode, tags);
}

export function analyzeCardPlayTiming(
  runId: string,
): { timingDistribution: Record<string, number>; modeSpecificTimings: string[] } {
  const meta = metadataStore.get(runId);
  const record = getRunRecord(runId);
  const plays = meta?.cardPlays ?? [];
  const behavior = getModeCardBehavior(record.mode);

  const distribution: Record<string, number> = {};
  for (const tc of Object.values(TimingClass)) {
    distribution[tc] = 0;
  }
  for (const play of plays) {
    distribution[play.timingClass] = (distribution[play.timingClass] ?? 0) + 1;
  }

  const modeSpecificTimings: string[] = [];
  if (behavior.counterWindowEnabled) modeSpecificTimings.push(TimingClass.CTR);
  if (behavior.aidWindowEnabled) modeSpecificTimings.push(TimingClass.AID);
  if (behavior.ghostEnabled) modeSpecificTimings.push(TimingClass.GBM);
  if (behavior.rescueEnabled) modeSpecificTimings.push(TimingClass.RES);

  return { timingDistribution: distribution, modeSpecificTimings };
}

// ─────────────────────────────────────────────────────────────────────────────
// GRADING & SOVEREIGNTY SCORING
// ─────────────────────────────────────────────────────────────────────────────

export function computeSovereigntyGrade(runId: string): SovereigntyGrade {
  const cached = gradeCache.get(runId);
  if (cached) return cached;

  const record = getRunRecord(runId);
  const snapshot = getRunState(runId);
  const ledger = snapshot.ledger;
  const turn = snapshot.turnCount;
  const mode = record.mode;
  const phase = determineRunPhase(turn);
  const pressureTier = determinePressureTier(ledger.heat, ledger.shield);
  const meta = metadataStore.get(runId);
  const plays = meta?.cardPlays ?? [];

  const cashComponent = round6(Math.max(ledger.cash, 0) * CORD_SCORING_WEIGHTS.cashWeight);
  const incomeComponent = round6(Math.max(ledger.income, 0) * CORD_SCORING_WEIGHTS.incomeWeight * 10);
  const shieldComponent = round6(Math.max(ledger.shield, 0) * CORD_SCORING_WEIGHTS.shieldWeight);
  const heatPenaltyComponent = round6(Math.max(ledger.heat, 0) * CORD_SCORING_WEIGHTS.heatPenalty * 500);
  const efficiency = computeEfficiencyRatio(ledger);
  const efficiencyComponent = round6(efficiency * CORD_SCORING_WEIGHTS.efficiencyWeight * 100);

  let trustBonusComponent = 0;
  if (mode === GameMode.TEAM_UP) {
    const trustResult = computeTrustEfficiency(ledger.trust);
    trustBonusComponent = round6(trustResult.efficiency * CORD_SCORING_WEIGHTS.trustBonus * 100);
  }

  let divergenceBonusComponent = 0;
  if (mode === GameMode.CHASE_A_LEGEND) {
    divergenceBonusComponent = round6(Math.max(ledger.divergence, 0) * CORD_SCORING_WEIGHTS.divergenceBonus * 10);
  }

  const ledgerTimeline = buildLedgerTimeline(record);
  const phaseBonuses = computePhaseBonuses(ledgerTimeline, mode);
  const badges = computeBadgesEarned(ledger, turn, mode, plays);

  let phaseMultiplier = 1.0;
  switch (phase) {
    case RunPhase.FOUNDATION: phaseMultiplier = 0.8; break;
    case RunPhase.ESCALATION: phaseMultiplier = 1.0; break;
    case RunPhase.SOVEREIGNTY: phaseMultiplier = 1.3; break;
  }

  const pressureCostMod = computePressureCostModifier(pressureTier);
  const phaseBonusTotal = Object.values(phaseBonuses).reduce((a, b) => a + b, 0);
  const badgeBonus = badges.length * 15;

  const raw = (cashComponent + incomeComponent + shieldComponent + efficiencyComponent +
    trustBonusComponent + divergenceBonusComponent + phaseBonusTotal + badgeBonus -
    heatPenaltyComponent) * phaseMultiplier / Math.max(pressureCostMod, 0.5);

  const cordScore = round6(Math.max(raw + ledger.cords, 0));
  const numericScore = round6(cordScore);
  const letter = letterGradeFromScore(numericScore);

  const grade: SovereigntyGrade = {
    letter,
    numericScore,
    cordScore,
    cashComponent,
    incomeComponent,
    shieldComponent,
    heatPenaltyComponent,
    trustBonusComponent,
    divergenceBonusComponent,
    efficiencyComponent,
    phaseBonuses,
    badgesEarned: badges,
  };

  gradeCache.set(runId, grade);
  return grade;
}

export function computeQuickCordScore(runId: string): number {
  const record = getRunRecord(runId);
  const snapshot = getRunState(runId);
  return computeCordScoreForLedger(snapshot.ledger, snapshot.turnCount, record.mode);
}

// ─────────────────────────────────────────────────────────────────────────────
// PROOF ARTIFACT GENERATION & INTEGRITY
// ─────────────────────────────────────────────────────────────────────────────

export function generateProofArtifact(runId: string): ProofArtifact {
  const record = getRunRecord(runId);
  if (!record.finalized) {
    throw new Error(`Cannot generate proof for non-finalized run: ${runId}`);
  }

  const replayResult = buildReplayResult(record);
  const grade = computeSovereigntyGrade(runId);

  const ledgerHash = sha256Hex(stableStringify(replayResult.snapshot.ledger));
  const eventLogHash = sha256Hex(stableStringify(record.eventLog));

  const deterministicSignature = generateDeterministicSignature(
    runId,
    record.seed,
    replayResult.replayHash,
  );

  return {
    version: PROOF_ARTIFACT_VERSION,
    runId,
    seed: record.seed,
    replayHash: replayResult.replayHash,
    ledgerHash,
    eventLogHash,
    cordScore: grade.cordScore,
    grade: grade.letter,
    turnCount: replayResult.snapshot.turnCount,
    mode: record.mode,
    timestamp: record.createdAt + record.decisionCount + 1,
    deterministicSignature,
  };
}

export function verifyProofArtifact(
  artifact: ProofArtifact,
  runId: string,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  try {
    const record = getRunRecord(runId);
    const replayResult = buildReplayResult(record);

    if (artifact.replayHash !== replayResult.replayHash) {
      errors.push(`Replay hash mismatch: expected ${replayResult.replayHash}, got ${artifact.replayHash}`);
    }

    const ledgerHash = sha256Hex(stableStringify(replayResult.snapshot.ledger));
    if (artifact.ledgerHash !== ledgerHash) {
      errors.push(`Ledger hash mismatch: expected ${ledgerHash}, got ${artifact.ledgerHash}`);
    }

    const eventLogHash = sha256Hex(stableStringify(record.eventLog));
    if (artifact.eventLogHash !== eventLogHash) {
      errors.push(`Event log hash mismatch: expected ${eventLogHash}, got ${artifact.eventLogHash}`);
    }

    if (artifact.seed !== record.seed) {
      errors.push(`Seed mismatch: expected ${record.seed}, got ${artifact.seed}`);
    }

    const expectedSig = generateDeterministicSignature(runId, record.seed, replayResult.replayHash);
    if (artifact.deterministicSignature !== expectedSig) {
      errors.push(`Signature mismatch: expected ${expectedSig}, got ${artifact.deterministicSignature}`);
    }

    if (artifact.version !== PROOF_ARTIFACT_VERSION) {
      errors.push(`Version mismatch: expected ${PROOF_ARTIFACT_VERSION}, got ${artifact.version}`);
    }

    if (artifact.turnCount !== replayResult.snapshot.turnCount) {
      errors.push(`Turn count mismatch: expected ${replayResult.snapshot.turnCount}, got ${artifact.turnCount}`);
    }

    if (artifact.mode !== record.mode) {
      errors.push(`Mode mismatch: expected ${record.mode}, got ${artifact.mode}`);
    }
  } catch (e) {
    errors.push(`Verification error: ${e instanceof Error ? e.message : String(e)}`);
  }

  return { valid: errors.length === 0, errors };
}

export function generateIntegrityHash(runId: string): string {
  const record = getRunRecord(runId);
  const replayResult = buildReplayResult(record);
  const payload = stableStringify({
    runId,
    seed: record.seed,
    replayHash: replayResult.replayHash,
    turnCount: replayResult.snapshot.turnCount,
    finalized: record.finalized,
    mode: record.mode,
  });
  return createHash('sha256').update(payload).digest('hex');
}

// ─────────────────────────────────────────────────────────────────────────────
// ML FEATURE EXTRACTION (24-dim)
// ─────────────────────────────────────────────────────────────────────────────

export function extractRunMLFeatures(runId: string): RunMLFeatureVector {
  const record = getRunRecord(runId);
  const snapshot = getRunState(runId);
  const ledger = snapshot.ledger;
  const grade = computeSovereigntyGrade(runId);
  const pressureTimeline = computePressureTimeline(runId);
  const mode = record.mode;
  const behavior = getModeCardBehavior(mode);
  const meta = metadataStore.get(runId);
  const plays = meta?.cardPlays ?? [];
  const turnCount = Math.max(snapshot.turnCount, 1);

  // Normalize all features to [0, 1] range
  const f: number[] = [];

  // 0: normalized cash
  f.push(clamp(ledger.cash / 5000, 0, 1));

  // 1: normalized income
  f.push(clamp(ledger.income / 500, 0, 1));

  // 2: normalized expenses
  f.push(clamp(ledger.expenses / 500, 0, 1));

  // 3: normalized shield
  f.push(clamp(ledger.shield / 100, 0, 1));

  // 4: heat (already 0-1ish range)
  f.push(clamp(ledger.heat, 0, 1));

  // 5: trust normalized
  f.push(clamp(ledger.trust / 100, 0, 1));

  // 6: divergence normalized
  f.push(clamp(ledger.divergence / 100, 0, 1));

  // 7: cords normalized
  f.push(clamp(ledger.cords / 500, 0, 1));

  // 8: turn progress
  f.push(clamp(turnCount / MAX_TURNS_PER_RUN, 0, 1));

  // 9: cord score normalized
  f.push(clamp(grade.cordScore / 1500, 0, 1));

  // 10: grade ordinal
  const gradeOrdinals: Record<string, number> = { S: 1.0, A: 0.83, B: 0.67, C: 0.5, D: 0.33, F: 0.17 };
  f.push(gradeOrdinals[grade.letter] ?? 0);

  // 11: mode ordinal
  const modeOrd: Record<string, number> = {
    [GameMode.GO_ALONE]: 0,
    [GameMode.HEAD_TO_HEAD]: 0.33,
    [GameMode.TEAM_UP]: 0.67,
    [GameMode.CHASE_A_LEGEND]: 1.0,
  };
  f.push(modeOrd[mode] ?? 0);

  // 12: efficiency ratio normalized
  f.push(clamp(computeEfficiencyRatio(ledger) / 5, 0, 1));

  // 13: survival margin normalized
  f.push(clamp(computeSurvivalMargin(ledger) / 3000, 0, 1));

  // 14: net worth normalized
  f.push(clamp(computeNetWorth(ledger) / 10000, 0, 1));

  // 15: average pressure tier
  let totalPressure = 0;
  for (const entry of pressureTimeline) {
    const tierValues: Record<string, number> = {
      [PressureTier.T0_SOVEREIGN]: 0,
      [PressureTier.T1_STABLE]: 0.25,
      [PressureTier.T2_STRESSED]: 0.5,
      [PressureTier.T3_ELEVATED]: 0.75,
      [PressureTier.T4_COLLAPSE_IMMINENT]: 1.0,
    };
    totalPressure += tierValues[entry.pressureTier] ?? 0;
  }
  f.push(pressureTimeline.length > 0 ? round6(totalPressure / pressureTimeline.length) : 0.25);

  // 16: deck diversity
  f.push(computeDeckDiversity(plays));

  // 17: IPA chain complete flag
  const ipaResult = computeIpaChainForPlays(plays);
  f.push(ipaResult.complete ? 1 : 0);

  // 18: hold enabled flag
  f.push(behavior.holdEnabled ? 1 : 0);

  // 19: battle budget enabled flag
  f.push(behavior.battleBudgetEnabled ? 1 : 0);

  // 20: trust system enabled flag
  f.push(behavior.trustEnabled ? 1 : 0);

  // 21: ghost system enabled flag
  f.push(behavior.ghostEnabled ? 1 : 0);

  // 22: phase bonus total normalized
  const phaseBonuses = grade.phaseBonuses;
  const phaseBonusTotal = Object.values(phaseBonuses).reduce((a, b) => a + b, 0);
  f.push(clamp(phaseBonusTotal / 200, 0, 1));

  // 23: badge count normalized
  f.push(clamp(grade.badgesEarned.length / 10, 0, 1));

  const labels = [
    'cash_norm', 'income_norm', 'expenses_norm', 'shield_norm',
    'heat', 'trust_norm', 'divergence_norm', 'cords_norm',
    'turn_progress', 'cord_score_norm', 'grade_ordinal', 'mode_ordinal',
    'efficiency_ratio', 'survival_margin', 'net_worth', 'avg_pressure_tier',
    'deck_diversity', 'ipa_chain_flag', 'hold_enabled', 'bb_enabled',
    'trust_enabled', 'ghost_enabled', 'phase_bonus_norm', 'badge_count_norm',
  ];

  // Cross-reference the card_types ML feature dimension constant
  void CARD_ML_FEATURE_DIMENSION;
  void CARD_ML_FEATURE_LABELS;

  return {
    features: f.map(v => round6(v)),
    labels,
    dimension: RUN_ML_FEATURE_DIM,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DL TENSOR EXTRACTION (40x8)
// ─────────────────────────────────────────────────────────────────────────────

export function extractRunDLTensor(runId: string): RunDLTensor {
  const record = getRunRecord(runId);
  const ledgerTimeline = buildLedgerTimeline(record);
  const mode = record.mode;
  const data: number[][] = [];

  const colLabels = [
    'cash_delta', 'income_delta', 'shield_delta', 'heat_delta',
    'trust_delta', 'cords_delta', 'pressure_tier_ord', 'phase_ord',
  ];

  for (let row = 0; row < DL_TENSOR_ROWS; row++) {
    const turnIndex = Math.min(row, ledgerTimeline.length - 1);
    const curr = ledgerTimeline[turnIndex];
    const prev = turnIndex > 0 ? ledgerTimeline[turnIndex - 1] : curr;

    const delta = computeLedgerDelta(prev, curr);
    const pressureTier = determinePressureTier(curr.heat, curr.shield);
    const phase = determineRunPhase(turnIndex);

    const pressureOrd: Record<string, number> = {
      [PressureTier.T0_SOVEREIGN]: 0,
      [PressureTier.T1_STABLE]: 0.25,
      [PressureTier.T2_STRESSED]: 0.5,
      [PressureTier.T3_ELEVATED]: 0.75,
      [PressureTier.T4_COLLAPSE_IMMINENT]: 1.0,
    };

    const phaseOrd: Record<string, number> = {
      [RunPhase.FOUNDATION]: 0,
      [RunPhase.ESCALATION]: 0.5,
      [RunPhase.SOVEREIGNTY]: 1.0,
    };

    // Incorporate mode-specific normalization
    const modeBehavior = getModeCardBehavior(mode);
    const trustDeltaNorm = modeBehavior.trustEnabled
      ? clamp(delta.trust / 20, -1, 1)
      : 0;

    data.push([
      clamp(delta.cash / 1000, -1, 1),
      clamp(delta.income / 100, -1, 1),
      clamp(delta.shield / 50, -1, 1),
      clamp(delta.heat / 0.5, -1, 1),
      trustDeltaNorm,
      clamp(delta.cords / 50, -1, 1),
      pressureOrd[pressureTier] ?? 0.25,
      phaseOrd[phase] ?? 0,
    ].map(v => round6(v)));
  }

  return {
    data,
    rows: DL_TENSOR_ROWS,
    cols: DL_TENSOR_COLS,
    labels: colLabels,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ADVANCED ANALYTICS
// ─────────────────────────────────────────────────────────────────────────────

export function computeAdvancedAnalytics(runId: string): AdvancedAnalytics {
  const cached = analyticsCache.get(runId);
  if (cached) return cached;

  const record = getRunRecord(runId);
  const ledgerTimeline = buildLedgerTimeline(record);

  const cashValues = ledgerTimeline.map(l => l.cash);
  const incomeValues = ledgerTimeline.map(l => l.income);
  const shieldValues = ledgerTimeline.map(l => l.shield);
  const heatValues = ledgerTimeline.map(l => l.heat);
  const cordValues = ledgerTimeline.map(l => l.cords);

  const cashVelocities = computeVelocity(cashValues, VELOCITY_WINDOW);
  const incomeVelocities = computeVelocity(incomeValues, VELOCITY_WINDOW);
  const shieldVelocities = computeVelocity(shieldValues, VELOCITY_WINDOW);
  const heatVelocities = computeVelocity(heatValues, VELOCITY_WINDOW);
  const cordVelocities = computeVelocity(cordValues, VELOCITY_WINDOW);

  const cashAccel = computeAcceleration(cashVelocities);
  const incomeAccel = computeAcceleration(incomeVelocities);
  const shieldAccel = computeAcceleration(shieldVelocities);
  const heatAccel = computeAcceleration(heatVelocities);
  const cordAccel = computeAcceleration(cordVelocities);

  const criticalTicks = findCriticalTicks(ledgerTimeline);
  const momentumScore = computeMomentumScore(ledgerTimeline);
  const volatilityIndex = computeVolatilityIndex(cashValues);
  const recoveryCount = countRecoveries(cashValues);

  let peakCash = -Infinity;
  let peakCashTurn = 0;
  let troughCash = Infinity;
  let troughCashTurn = 0;

  for (let i = 0; i < cashValues.length; i++) {
    if (cashValues[i] > peakCash) {
      peakCash = cashValues[i];
      peakCashTurn = i;
    }
    if (cashValues[i] < troughCash) {
      troughCash = cashValues[i];
      troughCashTurn = i;
    }
  }

  const result: AdvancedAnalytics = {
    velocities: {
      cash: cashVelocities,
      income: incomeVelocities,
      shield: shieldVelocities,
      heat: heatVelocities,
      cords: cordVelocities,
    },
    accelerations: {
      cash: cashAccel,
      income: incomeAccel,
      shield: shieldAccel,
      heat: heatAccel,
      cords: cordAccel,
    },
    criticalTicks,
    momentumScore,
    peakCash: round6(peakCash === -Infinity ? 0 : peakCash),
    peakCashTurn,
    troughCash: round6(troughCash === Infinity ? 0 : troughCash),
    troughCashTurn,
    volatilityIndex,
    recoveryCount,
  };

  analyticsCache.set(runId, result);
  return result;
}

export function computeResourceCorrelation(runId: string): Record<string, number> {
  const record = getRunRecord(runId);
  const ledgerTimeline = buildLedgerTimeline(record);

  if (ledgerTimeline.length < 3) {
    return { cashIncome: 0, cashHeat: 0, incomeShield: 0, heatCords: 0 };
  }

  function pearsonCorrelation(xs: number[], ys: number[]): number {
    const n = Math.min(xs.length, ys.length);
    if (n < 2) return 0;
    const meanX = xs.slice(0, n).reduce((a, b) => a + b, 0) / n;
    const meanY = ys.slice(0, n).reduce((a, b) => a + b, 0) / n;
    let num = 0;
    let denomX = 0;
    let denomY = 0;
    for (let i = 0; i < n; i++) {
      const dx = xs[i] - meanX;
      const dy = ys[i] - meanY;
      num += dx * dy;
      denomX += dx * dx;
      denomY += dy * dy;
    }
    const denom = Math.sqrt(denomX * denomY);
    return denom > 0 ? round6(num / denom) : 0;
  }

  const cash = ledgerTimeline.map(l => l.cash);
  const income = ledgerTimeline.map(l => l.income);
  const shield = ledgerTimeline.map(l => l.shield);
  const heat = ledgerTimeline.map(l => l.heat);
  const cords = ledgerTimeline.map(l => l.cords);

  return {
    cashIncome: pearsonCorrelation(cash, income),
    cashHeat: pearsonCorrelation(cash, heat),
    incomeShield: pearsonCorrelation(income, shield),
    heatCords: pearsonCorrelation(heat, cords),
    shieldHeat: pearsonCorrelation(shield, heat),
    cashCords: pearsonCorrelation(cash, cords),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GHOST COMPARISON & DIVERGENCE ANALYSIS
// ─────────────────────────────────────────────────────────────────────────────

export async function createGhostRun(
  ghostSeed: number,
  turns: number,
  initialLedger?: Partial<Ledger>,
): Promise<string> {
  const config: RunConfig = {
    mode: GameMode.CHASE_A_LEGEND,
    modeCode: 'ghost',
    seed: ghostSeed,
    initialLedger: initialLedger ?? {},
    maxTurns: turns,
    ghostSeed: combineSeed(ghostSeed, 'legend'),
  };
  const runId = await createRunWithConfig(config);

  // Simulate ghost turns using deterministic strategy
  const rng = createDeterministicRng(normalizeSeed(ghostSeed));
  const seedRecord = getRunRecord(runId);
  const initialCash = seedRecord.initialLedger.cash;
  const scaleFactor = initialCash > 0 ? clamp(initialCash / 1000, 0.5, 3.0) : 1.0;

  for (let t = 0; t < turns; t++) {
    const ghostChoiceValue = rng.next();
    const cashDelta = round6(((ghostChoiceValue * 200) - 50) * scaleFactor);
    const incomeDelta = round6(((rng.next() * 30) - 5) * scaleFactor);
    const heatDelta = round6((rng.next() * 0.1) - 0.03);
    const shieldDelta = round6((rng.next() * 15) - 3);
    const divergenceDelta = round6(rng.next() * 5);
    const cordDelta = round6(rng.next() * 20);

    const effects: DecisionEffect[] = [
      { target: 'cash', delta: cashDelta },
      { target: 'income', delta: incomeDelta },
      { target: 'heat', delta: heatDelta },
      { target: 'shield', delta: shieldDelta },
      { target: 'divergence', delta: divergenceDelta },
      { target: 'cords', delta: cordDelta },
    ];

    await submitTurnDecision(runId, {
      turnIndex: t,
      choiceId: `ghost_choice_${t}_${computeLightweightHash(String(ghostChoiceValue), normalizeSeed(ghostSeed))}`,
      effects,
    });
  }

  return runId;
}

export function compareWithGhost(
  playerRunId: string,
  ghostRunId: string,
): GhostComparisonResult {
  const playerRecord = getRunRecord(playerRunId);
  const ghostRecord = getRunRecord(ghostRunId);
  const playerTimeline = buildLedgerTimeline(playerRecord);
  const ghostTimeline = buildLedgerTimeline(ghostRecord);

  const maxTurns = Math.min(playerTimeline.length, ghostTimeline.length);
  const alignments: GhostTurnAlignment[] = [];
  let totalDivergence = 0;
  let maxDivergence = 0;
  let markerExploits = 0;

  const ghostSeed = ghostRecord.ghostSeed ?? ghostRecord.seed;

  for (let t = 0; t < maxTurns; t++) {
    const pLedger = playerTimeline[t];
    const gLedger = ghostTimeline[t];

    const cashDiv = Math.abs(pLedger.cash - gLedger.cash);
    const incomeDiv = Math.abs(pLedger.income - gLedger.income);
    const shieldDiv = Math.abs(pLedger.shield - gLedger.shield);
    const heatDiv = Math.abs(pLedger.heat - gLedger.heat);
    const trustDiv = Math.abs(pLedger.trust - gLedger.trust);
    const cordsDiv = Math.abs(pLedger.cords - gLedger.cords);

    const divergenceScore = round6(
      cashDiv * 0.001 + incomeDiv * 0.01 + shieldDiv * 0.02 +
      heatDiv * 5 + trustDiv * 0.05 + cordsDiv * 0.03,
    );

    totalDivergence += divergenceScore;
    if (divergenceScore > maxDivergence) {
      maxDivergence = divergenceScore;
    }

    const markerKind = resolveGhostMarkerForTurn(t, ghostSeed);
    let exploited = false;
    if (markerKind) {
      const spec = GHOST_MARKER_SPECS[markerKind];
      // Player exploits marker if their divergence is above tolerance and they have CORD gain
      if (divergenceScore > GHOST_ALIGNMENT_TOLERANCE && pLedger.cords > gLedger.cords) {
        exploited = true;
        markerExploits += 1;
        void spec.exploitWindowTicks;
      }
    }

    alignments.push({
      turn: t,
      ghostLedger: gLedger,
      playerLedger: pLedger,
      divergenceScore,
      markerKind,
      exploited,
    });
  }

  const avgDivergence = maxTurns > 0 ? round6(totalDivergence / maxTurns) : 0;

  const overallDivPotential = maxDivergence > 5 ? DivergencePotential.HIGH :
    maxDivergence > 2 ? DivergencePotential.MEDIUM : DivergencePotential.LOW;

  return {
    ghostRunId,
    playerRunId,
    turnAlignments: alignments,
    totalDivergence: round6(totalDivergence),
    averageDivergence: avgDivergence,
    maxDivergence: round6(maxDivergence),
    markerExploits,
    divergencePotential: overallDivPotential,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// RUN SIMULATION WITH MULTIPLE STRATEGIES
// ─────────────────────────────────────────────────────────────────────────────

export async function simulateRunWithStrategy(
  seed: number,
  mode: GameMode,
  strategyName: string,
  ticks: number = DEFAULT_SIMULATION_TICKS,
): Promise<SimulationResult> {
  const modeCode = Object.entries(MODE_CODE_MAP).find(([_, v]) => v === mode)?.[0] as ModeCode ?? 'solo';
  const config: RunConfig = {
    mode,
    modeCode,
    seed,
    initialLedger: { cash: 1000, income: 50, trust: 50 },
    maxTurns: ticks,
  };

  const runId = await createRunWithConfig(config);
  const rng = createDeterministicRng(normalizeSeed(seed));
  const behavior = getModeCardBehavior(mode);
  const legalDecks = CARD_LEGALITY_MATRIX[mode];

  for (let t = 0; t < ticks; t++) {
    const effects: DecisionEffect[] = [];

    switch (strategyName) {
      case 'aggressive': {
        const deckType = pickWeightedDeckType(mode, rng);
        const profile = getDeckTypeProfile(deckType);
        effects.push({ target: 'cash', delta: round6((rng.next() * 300) - 100) });
        effects.push({ target: 'income', delta: round6(rng.next() * 40) });
        effects.push({ target: 'heat', delta: round6(profile.baselineHeat + rng.next() * 0.08) });
        effects.push({ target: 'shield', delta: round6((rng.next() * 10) - 5) });
        effects.push({ target: 'cords', delta: round6(rng.next() * profile.baselineCordWeight * 15) });
        break;
      }
      case 'conservative': {
        effects.push({ target: 'cash', delta: round6(rng.next() * 80) });
        effects.push({ target: 'income', delta: round6(rng.next() * 15) });
        effects.push({ target: 'heat', delta: round6(-0.01 - rng.next() * 0.02) });
        effects.push({ target: 'shield', delta: round6(rng.next() * 20) });
        effects.push({ target: 'cords', delta: round6(rng.next() * 8) });
        break;
      }
      case 'balanced': {
        const deckType = pickWeightedDeckType(mode, rng);
        const rarity = pickWeightedRarityForDeck(deckType, rng);
        const tags = pickTagsForDeck(deckType, mode, rng);
        const tagScore = computeTagWeightedScore(tags, mode);
        const profile = getDeckTypeProfile(deckType);

        effects.push({ target: 'cash', delta: round6((rng.next() * 150) - 30) });
        effects.push({ target: 'income', delta: round6(rng.next() * 25) });
        effects.push({ target: 'heat', delta: round6(profile.baselineHeat * 0.5 + rng.next() * 0.03) });
        effects.push({ target: 'shield', delta: round6(rng.next() * 12) });
        effects.push({ target: 'cords', delta: round6(tagScore * 3 + rng.next() * 10) });

        const rarityBonus = rarity === CardRarity.LEGENDARY ? 15 :
          rarity === CardRarity.RARE ? 8 : rarity === CardRarity.UNCOMMON ? 3 : 0;
        if (rarityBonus > 0) {
          effects.push({ target: 'cords', delta: rarityBonus });
        }
        break;
      }
      case 'ghost_chaser': {
        if (mode === GameMode.CHASE_A_LEGEND) {
          const ghostMarker = resolveGhostMarkerForTurn(t, seed);
          if (ghostMarker) {
            const cordBonus = computeGhostMarkerCordBonus(ghostMarker);
            const shieldBonus = computeGhostMarkerShieldBonus(ghostMarker);
            effects.push({ target: 'cords', delta: cordBonus });
            effects.push({ target: 'shield', delta: shieldBonus });
            effects.push({ target: 'divergence', delta: round6(rng.next() * 8) });
          }
          effects.push({ target: 'cash', delta: round6((rng.next() * 120) - 20) });
          effects.push({ target: 'heat', delta: round6(rng.next() * 0.04) });

          const timingClass = pickTimingClassForMode(mode, rng);
          const divPotential = computeDivergencePotentialForTurn(t, DeckType.GHOST, timingClass, seed);
          void divPotential;
        } else {
          effects.push({ target: 'cash', delta: round6(rng.next() * 100) });
          effects.push({ target: 'cords', delta: round6(rng.next() * 10) });
        }
        break;
      }
      case 'trust_builder': {
        if (mode === GameMode.TEAM_UP) {
          effects.push({ target: 'trust', delta: round6(rng.next() * 3) });
          effects.push({ target: 'cash', delta: round6((rng.next() * 100) - 20) });
          effects.push({ target: 'income', delta: round6(rng.next() * 10) });
          effects.push({ target: 'heat', delta: round6(-rng.next() * 0.02) });
          effects.push({ target: 'cords', delta: round6(rng.next() * 12) });

          const trustEff = computeTrustEfficiency(50 + t * 0.5);
          if (trustEff.band === TrustBand.SOVEREIGN_TRUST) {
            effects.push({ target: 'cords', delta: 10 });
          }
        } else {
          effects.push({ target: 'cash', delta: round6(rng.next() * 80) });
          effects.push({ target: 'cords', delta: round6(rng.next() * 8) });
        }
        break;
      }
      default: {
        effects.push({ target: 'cash', delta: round6((rng.next() * 100) - 20) });
        effects.push({ target: 'income', delta: round6(rng.next() * 15) });
        effects.push({ target: 'cords', delta: round6(rng.next() * 10) });
        break;
      }
    }

    // Mode-specific additions
    if (behavior.trustEnabled && t % 3 === 0) {
      effects.push({ target: 'trust', delta: round6(rng.next() * 2 - 0.5) });
    }

    void legalDecks;

    await submitTurnDecision(runId, {
      turnIndex: t,
      choiceId: `${strategyName}_t${t}`,
      effects,
    });
  }

  const result = await finalizeRun(runId);
  const grade = computeSovereigntyGrade(runId);

  return {
    strategyName,
    finalSnapshot: result.snapshot,
    cordScore: grade.cordScore,
    grade: grade.letter,
    turnCount: ticks,
  };
}

export async function compareStrategies(
  seed: number,
  mode: GameMode,
  strategies: readonly string[],
  ticks: number = DEFAULT_SIMULATION_TICKS,
): Promise<SimulationResult[]> {
  const results: SimulationResult[] = [];
  for (let i = 0; i < strategies.length; i++) {
    const strategySeed = combineSeed(seed, strategies[i]);
    const result = await simulateRunWithStrategy(strategySeed, mode, strategies[i], ticks);
    results.push(result);
  }
  return results.sort((a, b) => b.cordScore - a.cordScore);
}

// ─────────────────────────────────────────────────────────────────────────────
// RUN COMPARISON & BATCH PROCESSING
// ─────────────────────────────────────────────────────────────────────────────

export function compareRuns(runIds: readonly string[]): RunComparisonResult {
  const runs: { runId: string; cordScore: number; grade: string }[] = [];

  for (const runId of runIds) {
    const grade = computeSovereigntyGrade(runId);
    runs.push({ runId, cordScore: grade.cordScore, grade: grade.letter });
  }

  runs.sort((a, b) => b.cordScore - a.cordScore);

  const scores = runs.map(r => r.cordScore);
  const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const variance = scores.length > 0
    ? scores.reduce((sum, s) => sum + (s - avg) ** 2, 0) / scores.length
    : 0;

  return {
    runs,
    bestRunId: runs.length > 0 ? runs[0].runId : '',
    worstRunId: runs.length > 0 ? runs[runs.length - 1].runId : '',
    averageCordScore: round6(avg),
    cordStdDev: round6(Math.sqrt(variance)),
  };
}

export function batchComputeGrades(runIds: readonly string[]): Record<string, SovereigntyGrade> {
  const results: Record<string, SovereigntyGrade> = {};
  for (const runId of runIds) {
    results[runId] = computeSovereigntyGrade(runId);
  }
  return results;
}

export function batchComputeMLFeatures(runIds: readonly string[]): Record<string, RunMLFeatureVector> {
  const results: Record<string, RunMLFeatureVector> = {};
  for (const runId of runIds) {
    results[runId] = extractRunMLFeatures(runId);
  }
  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// IMPORT/EXPORT FOR REPLAY TRANSPORT
// ─────────────────────────────────────────────────────────────────────────────

export function exportRun(runId: string): RunExportPacket {
  const record = getRunRecord(runId);
  const replayResult = buildReplayResult(record);

  return {
    version: RUN_RUNTIME_VERSION,
    runId: record.runId,
    seed: record.seed,
    mode: record.mode,
    replayBytesBase64: replayResult.replayBytesBase64,
    replayHash: replayResult.replayHash,
    metadata: { ...record.metadata },
    exportedAt: Date.now(),
  };
}

export async function importRun(packet: RunExportPacket): Promise<string> {
  if (!packet.runId || !packet.seed) {
    throw new Error('Invalid export packet: missing runId or seed.');
  }

  const normalizedSeed = normalizeSeed(packet.seed);
  const replayBytes = Buffer.from(packet.replayBytesBase64, 'base64');
  const replayData = JSON.parse(replayBytes.toString('utf8')) as ReplaySnapshot;

  const ledger = createDefaultLedger(replayData.ledger);
  const sequence = runSequence;
  const runId = buildRunId(normalizedSeed, ledger, sequence);
  const createdAt = sequence * 1000 + normalizedSeed;

  const createdEvent: RunCreatedEvent = {
    type: 'RUN_CREATED',
    runId,
    seed: normalizedSeed,
    createdAt,
    ledger,
  };

  const record: RunRecord = {
    runId,
    seed: normalizedSeed,
    createdAt,
    initialLedger: ledger,
    eventLog: [createdEvent],
    decisionCount: 0,
    finalized: false,
    mode: packet.mode ?? GameMode.GO_ALONE,
    maxTurns: MAX_TURNS_PER_RUN,
    ghostSeed: null,
    metadata: packet.metadata ?? {},
  };

  setRunRecord(record);
  runSequence += 1;

  return runId;
}

export function exportRunBatch(runIds: readonly string[]): RunExportPacket[] {
  return runIds.map(id => exportRun(id));
}

// ─────────────────────────────────────────────────────────────────────────────
// CHAT BRIDGE — Run lifecycle to chat event translation
// ─────────────────────────────────────────────────────────────────────────────

export function buildChatEventForRunCreated(runId: string): ChatBridgeEvent {
  const record = getRunRecord(runId);
  const behavior = getModeCardBehavior(record.mode);
  const holdConfig = HOLD_SYSTEM_CONFIG;
  const comebackConfig = COMEBACK_SURGE_CONFIG;

  return {
    type: buildChatEventType('created'),
    runId,
    timestamp: record.createdAt,
    payload: {
      seed: record.seed,
      mode: record.mode,
      maxTurns: record.maxTurns,
      holdEnabled: behavior.holdEnabled,
      baseHoldsPerRun: holdConfig.baseHoldsPerRun,
      comebackCashThreshold: comebackConfig.cashThresholdPct,
      stageMood: behavior.stageMood,
      defaultChannel: behavior.defaultChannel,
      initialLedger: record.initialLedger,
      ghostConfigured: record.ghostSeed !== null,
    },
  };
}

export function buildChatEventForTurnSubmitted(
  runId: string,
  turnIndex: number,
  choiceId: string,
): ChatBridgeEvent {
  const record = getRunRecord(runId);
  const snapshot = getRunState(runId);
  const ledger = snapshot.ledger;
  const phase = determineRunPhase(ledger.turn);
  const pressureTier = determinePressureTier(ledger.heat, ledger.shield);
  const trustBand = determineTrustBand(ledger.trust);

  const isCritical = turnIndex === PHASE_THRESHOLDS.foundationEnd ||
    turnIndex === PHASE_THRESHOLDS.escalationEnd;
  const bleedthrough = computeBleedthroughMultiplier(pressureTier, isCritical);

  return {
    type: buildChatEventType('turn_submitted'),
    runId,
    timestamp: record.createdAt + turnIndex + 1,
    payload: {
      turnIndex,
      choiceId,
      phase,
      pressureTier,
      trustBand,
      bleedthrough: round6(bleedthrough),
      ledger,
      cashDelta: turnIndex > 0 ? round6(ledger.cash - record.initialLedger.cash) : 0,
      isPhaseTransition: isCritical,
      mode: record.mode,
    },
  };
}

export function buildChatEventForRunFinalized(runId: string): ChatBridgeEvent {
  const record = getRunRecord(runId);
  const grade = computeSovereigntyGrade(runId);
  const snapshot = getRunState(runId);

  return {
    type: buildChatEventType('finalized'),
    runId,
    timestamp: record.createdAt + record.decisionCount + 1,
    payload: {
      grade: grade.letter,
      cordScore: grade.cordScore,
      numericScore: grade.numericScore,
      turnCount: snapshot.turnCount,
      finalLedger: snapshot.ledger,
      badgesEarned: grade.badgesEarned,
      phaseBonuses: grade.phaseBonuses,
      mode: record.mode,
    },
  };
}

export function buildChatEventForPhaseTransition(
  runId: string,
  fromPhase: RunPhase,
  toPhase: RunPhase,
): ChatBridgeEvent {
  const record = getRunRecord(runId);
  const snapshot = getRunState(runId);

  return {
    type: buildChatEventType('phase_transition'),
    runId,
    timestamp: record.createdAt + snapshot.turnCount,
    payload: {
      fromPhase,
      toPhase,
      turnCount: snapshot.turnCount,
      ledger: snapshot.ledger,
      mode: record.mode,
    },
  };
}

export function buildChatEventForGhostMarker(
  runId: string,
  markerKind: GhostMarkerKind,
  turn: number,
): ChatBridgeEvent {
  const record = getRunRecord(runId);
  const spec = GHOST_MARKER_SPECS[markerKind];

  return {
    type: buildChatEventType('ghost_marker'),
    runId,
    timestamp: record.createdAt + turn,
    payload: {
      markerKind,
      label: spec.label,
      cordBonus: spec.cordBonus,
      shieldBonus: spec.shieldBonus,
      exploitWindowTicks: spec.exploitWindowTicks,
      description: spec.description,
      turn,
    },
  };
}

export function buildChatEventForPressureSpike(
  runId: string,
  fromTier: PressureTier,
  toTier: PressureTier,
): ChatBridgeEvent {
  const record = getRunRecord(runId);
  const snapshot = getRunState(runId);
  const costModBefore = computePressureCostModifier(fromTier);
  const costModAfter = computePressureCostModifier(toTier);

  return {
    type: buildChatEventType('pressure_spike'),
    runId,
    timestamp: record.createdAt + snapshot.turnCount,
    payload: {
      fromTier,
      toTier,
      costModifierBefore: costModBefore,
      costModifierAfter: costModAfter,
      bleedthroughBefore: computeBleedthroughMultiplier(fromTier, false),
      bleedthroughAfter: computeBleedthroughMultiplier(toTier, false),
      ledger: snapshot.ledger,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DETERMINISM VERIFICATION
// ─────────────────────────────────────────────────────────────────────────────

export function verifyDeterminism(runId: string): DeterminismVerification {
  const record = getRunRecord(runId);

  // Replay twice and compare
  const engine1 = new ReplayEngine(record.seed, record.eventLog);
  const engine2 = new ReplayEngine(record.seed, record.eventLog);

  const snapshot1 = engine1.replayAll();
  const snapshot2 = engine2.replayAll();

  const hash1 = engine1.getReplayHash();
  const hash2 = engine2.getReplayHash();

  const ledgerMatch = stableStringify(snapshot1.ledger) === stableStringify(snapshot2.ledger);
  const turnCountMatch = snapshot1.turnCount === snapshot2.turnCount;
  const snapshotMatch = stableStringify(snapshot1) === stableStringify(snapshot2);

  let divergencePoint: number | null = null;
  if (!snapshotMatch) {
    // Walk the event log to find divergence point
    for (let i = 0; i <= record.decisionCount; i++) {
      const gs1 = engine1.getGameStateAtTurn(i);
      const gs2 = engine2.getGameStateAtTurn(i);
      if (stableStringify(gs1.snapshot().ledger) !== stableStringify(gs2.snapshot().ledger)) {
        divergencePoint = i;
        break;
      }
    }
  }

  return {
    verified: hash1 === hash2 && snapshotMatch,
    replayHash1: hash1,
    replayHash2: hash2,
    snapshotMatch,
    ledgerMatch,
    turnCountMatch,
    divergencePoint,
  };
}

export function verifyDeterminismAcrossSeeds(
  seed1: number,
  seed2: number,
  turns: number,
): { identical: boolean; divergeAtTurn: number | null } {
  if (normalizeSeed(seed1) !== normalizeSeed(seed2)) {
    return { identical: false, divergeAtTurn: 0 };
  }

  const rng1 = createDeterministicRng(normalizeSeed(seed1));
  const rng2 = createDeterministicRng(normalizeSeed(seed2));

  for (let t = 0; t < turns; t++) {
    const v1 = rng1.next();
    const v2 = rng2.next();
    if (v1 !== v2) {
      return { identical: false, divergeAtTurn: t };
    }
  }

  return { identical: true, divergeAtTurn: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// SEED ANALYSIS
// ─────────────────────────────────────────────────────────────────────────────

export function analyzeSeed(seed: number): SeedAnalysis {
  const normalized = normalizeSeed(seed);
  const seedStr = String(normalized);
  const seedHash = sha256Hex(seedStr);

  // Derive sub-seeds for different systems using combineSeed
  const derivedSubSeeds: Record<string, number> = {
    deckDraw: combineSeed(normalized, 'deck_draw'),
    ghostMarker: combineSeed(normalized, 'ghost_marker'),
    pressureRoll: combineSeed(normalized, 'pressure_roll'),
    cardEffect: combineSeed(normalized, 'card_effect'),
    phaseTransition: combineSeed(normalized, 'phase_transition'),
    trustFluctuation: combineSeed(normalized, 'trust_fluctuation'),
    heatDecay: combineSeed(normalized, 'heat_decay'),
    shieldRegen: combineSeed(normalized, 'shield_regen'),
  };

  // Use hashStringToSeed for entropy analysis
  const hashFromString = hashStringToSeed(`seed_analysis_${seedStr}`);

  // Generate RNG sample using createMulberry32
  const mulberry = createMulberry32(normalized);
  const rngSample: number[] = [];
  for (let i = 0; i < 20; i++) {
    rngSample.push(round6(mulberry()));
  }

  // Estimate entropy from sample distribution
  const buckets = new Array(10).fill(0);
  for (const v of rngSample) {
    const bucket = Math.min(Math.floor(v * 10), 9);
    buckets[bucket] += 1;
  }
  let entropy = 0;
  for (const count of buckets) {
    if (count > 0) {
      const p = count / rngSample.length;
      entropy -= p * Math.log2(p);
    }
  }

  // Check for collision risk
  const fallbackUsed = normalized === DEFAULT_NON_ZERO_SEED;
  const collisionRisk = fallbackUsed ? 'HIGH_DEFAULT_SEED' :
    entropy < 2.0 ? 'MEDIUM_LOW_ENTROPY' : 'LOW';

  void hashFromString;

  return {
    seed,
    normalizedSeed: normalized,
    seedHash,
    derivedSubSeeds,
    rngSample,
    entropyEstimate: round6(entropy),
    collisionRisk,
  };
}

export function generateSeedFromString(input: string): number {
  return hashStringToSeed(input);
}

export function deriveCombinedSeed(baseSeed: number, salt: string | number): number {
  return combineSeed(baseSeed, salt);
}

// ─────────────────────────────────────────────────────────────────────────────
// MODE ANALYSIS & DECK PROFILE QUERIES
// ─────────────────────────────────────────────────────────────────────────────

export function getModeLegalDecks(mode: GameMode): DeckType[] {
  return [...CARD_LEGALITY_MATRIX[mode]];
}

export function getModeBehaviorSummary(mode: GameMode): {
  mode: GameMode;
  primaryDecks: DeckType[];
  exclusiveDecks: DeckType[];
  bannedDecks: DeckType[];
  features: Record<string, boolean>;
  tagWeightProfile: Record<string, number>;
} {
  const behavior = getModeCardBehavior(mode);
  const weights = MODE_TAG_WEIGHT_DEFAULTS[mode];

  const tagProfile: Record<string, number> = {};
  for (const tag of Object.values(CardTag)) {
    tagProfile[tag] = weights[tag] ?? 0;
  }

  return {
    mode,
    primaryDecks: [...behavior.primaryDeckTypes],
    exclusiveDecks: [...behavior.exclusiveDeckTypes],
    bannedDecks: [...behavior.bannedDeckTypes],
    features: {
      holdEnabled: behavior.holdEnabled,
      battleBudgetEnabled: behavior.battleBudgetEnabled,
      trustEnabled: behavior.trustEnabled,
      ghostEnabled: behavior.ghostEnabled,
      rescueEnabled: behavior.rescueEnabled,
      counterWindowEnabled: behavior.counterWindowEnabled,
      aidWindowEnabled: behavior.aidWindowEnabled,
      phaseGatingEnabled: behavior.phaseGatingEnabled,
    },
    tagWeightProfile: tagProfile,
  };
}

export function getDeckProfileSummary(deckType: DeckType): {
  deckType: DeckType;
  baselineHeat: number;
  baselineCordWeight: number;
  drawRateMultiplier: number;
  autoResolveDefault: boolean;
  educationalCategory: string;
  legalInModes: GameMode[];
} {
  const profile = getDeckTypeProfile(deckType);
  const legalInModes: GameMode[] = [];
  for (const mode of Object.values(GameMode)) {
    if (CARD_LEGALITY_MATRIX[mode].includes(deckType)) {
      legalInModes.push(mode);
    }
  }
  return {
    deckType: profile.deckType,
    baselineHeat: profile.baselineHeat,
    baselineCordWeight: profile.baselineCordWeight,
    drawRateMultiplier: profile.drawRateMultiplier,
    autoResolveDefault: profile.autoResolveDefault,
    educationalCategory: profile.educationalCategory,
    legalInModes,
  };
}

export function getAllDeckProfiles(): Record<string, ReturnType<typeof getDeckProfileSummary>> {
  const result: Record<string, ReturnType<typeof getDeckProfileSummary>> = {};
  for (const dt of Object.values(DeckType)) {
    result[dt] = getDeckProfileSummary(dt);
  }
  return result;
}

export function computeIpaChainAnalysis(deckTypesInPlay: readonly DeckType[]): {
  complete: boolean;
  tier: string;
  synergyCount: number;
  availableSynergies: readonly { combination: string[]; tier: string; durationTicks: number | null }[];
} {
  const result = isIPAChainComplete(deckTypesInPlay);
  return {
    complete: result.complete,
    tier: result.tier,
    synergyCount: result.synergies.length,
    availableSynergies: IPA_CHAIN_SYNERGIES.map(s => ({
      combination: [...s.combination],
      tier: s.tier,
      durationTicks: s.durationTicks,
    })),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// TRUST ANALYSIS
// ─────────────────────────────────────────────────────────────────────────────

export function computeTrustAnalysis(trustScore: number): {
  band: TrustBand;
  efficiency: number;
  loanAccessPct: number;
  comboBonus: number;
  allTiers: readonly { band: TrustBand; minScore: number; maxScore: number; aidEfficiency: number }[];
} {
  const result = computeTrustEfficiency(trustScore);
  const allTiers = TRUST_SCORE_TIERS.map(t => ({
    band: t.band,
    minScore: t.minScore,
    maxScore: t.maxScore,
    aidEfficiency: t.aidEfficiency,
  }));

  return {
    ...result,
    allTiers,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PRESSURE TIER ANALYSIS
// ─────────────────────────────────────────────────────────────────────────────

export function computePressureAnalysis(heat: number, shield: number): {
  tier: PressureTier;
  costModifier: number;
  bleedthrough: number;
  heatDecayRate: number;
  allTierCosts: Record<string, number>;
} {
  const tier = determinePressureTier(heat, shield);
  const costMod = computePressureCostModifier(tier);
  const bleed = computeBleedthroughMultiplier(tier, false);
  const decay = computeHeatDecayRate(tier);

  const allTierCosts: Record<string, number> = {};
  for (const t of Object.values(PressureTier)) {
    allTierCosts[t] = PRESSURE_COST_MODIFIERS[t] ?? 1.0;
  }

  return {
    tier,
    costModifier: costMod,
    bleedthrough: round6(bleed),
    heatDecayRate: decay,
    allTierCosts,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// EFFECT TARGET UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

export function getEffectTargetMap(): Map<EffectTarget, string> {
  return buildEffectTargetMap();
}

export function validateEffectTargetList(targets: readonly EffectTarget[]): {
  valid: boolean;
  invalidTargets: string[];
} {
  const validTargets: EffectTarget[] = ['cash', 'income', 'expenses', 'shield', 'heat', 'trust', 'divergence', 'cords'];
  const invalid: string[] = [];

  for (const t of targets) {
    if (!validTargets.includes(t)) {
      invalid.push(t);
    }
  }

  return { valid: invalid.length === 0, invalidTargets: invalid };
}

// ─────────────────────────────────────────────────────────────────────────────
// CARD TYPE SIMULATION HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export function simulateCardEffects(
  deckType: DeckType,
  mode: GameMode,
  rarity: CardRarity,
  tags: readonly CardTag[],
  pressureTier: PressureTier,
): {
  estimatedCordDelta: number;
  tagWeightedScore: number;
  pressureCostModifier: number;
  bleedthrough: number;
  deckProfile: { baselineHeat: number; baselineCordWeight: number };
} {
  const tagScore = computeTagWeightedScore(tags, mode);
  const costMod = computePressureCostModifier(pressureTier);
  const bleed = computeBleedthroughMultiplier(pressureTier, false);
  const profile = getDeckTypeProfile(deckType);

  const rarityMultipliers: Record<string, number> = {
    [CardRarity.COMMON]: 1.0,
    [CardRarity.UNCOMMON]: 1.2,
    [CardRarity.RARE]: 1.5,
    [CardRarity.LEGENDARY]: 2.0,
  };

  const rarityMul = rarityMultipliers[rarity] ?? 1.0;
  const estimatedCord = round6(
    tagScore * profile.baselineCordWeight * rarityMul / costMod,
  );

  return {
    estimatedCordDelta: estimatedCord,
    tagWeightedScore: tagScore,
    pressureCostModifier: costMod,
    bleedthrough: round6(bleed),
    deckProfile: {
      baselineHeat: profile.baselineHeat,
      baselineCordWeight: profile.baselineCordWeight,
    },
  };
}

export function simulateDivergencePotential(
  deckType: DeckType,
  timingClass: TimingClass,
  tickDistance: number,
): {
  potential: DivergencePotential;
  description: string;
} {
  const mockDef = {
    cardId: `sim_div_${deckType}`,
    name: `Sim Divergence ${deckType}`,
    deckType,
    baseCost: 0,
    effects: [],
    tags: [],
    timingClasses: [timingClass],
    rarity: CardRarity.COMMON,
    autoResolve: false,
    counterability: 'NONE' as any,
    targeting: 'SELF' as any,
  } as CardDefinition;

  const potential = computeDivergencePotential(mockDef, timingClass, tickDistance);

  const descriptions: Record<string, string> = {
    [DivergencePotential.LOW]: 'Minimal divergence expected from this play.',
    [DivergencePotential.MEDIUM]: 'Moderate divergence opportunity available.',
    [DivergencePotential.HIGH]: 'High divergence potential — significant CORD opportunity.',
  };

  return {
    potential,
    description: descriptions[potential] ?? 'Unknown potential.',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// RUN LIFECYCLE UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

export function getActiveRunIds(): string[] {
  const ids: string[] = [];
  for (const [id, record] of runStore) {
    if (!record.finalized) {
      ids.push(id);
    }
  }
  return ids;
}

export function getFinalizedRunIds(): string[] {
  const ids: string[] = [];
  for (const [id, record] of runStore) {
    if (record.finalized) {
      ids.push(id);
    }
  }
  return ids;
}

export function getRunCount(): { total: number; active: number; finalized: number } {
  let active = 0;
  let finalized = 0;
  for (const record of runStore.values()) {
    if (record.finalized) {
      finalized += 1;
    } else {
      active += 1;
    }
  }
  return { total: runStore.size, active, finalized };
}

export function getRunMode(runId: string): GameMode {
  return getRunRecord(runId).mode;
}

export function getRunSeed(runId: string): number {
  return getRunRecord(runId).seed;
}

export function getRunEventLog(runId: string): readonly RunEvent[] {
  const record = getRunRecord(runId);
  const engine = new ReplayEngine(record.seed, record.eventLog);
  return engine.getEvents();
}

/**
 * Alias for getRunEventLog — backward-compatible name used by src/index.ts.
 */
export function getRunEvents(runId: string): readonly RunEvent[] {
  return getRunEventLog(runId);
}

export function getRunTurnCount(runId: string): number {
  return getRunRecord(runId).decisionCount;
}

export function isRunFinalized(runId: string): boolean {
  return getRunRecord(runId).finalized;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMBO & SURGE ANALYSIS
// ─────────────────────────────────────────────────────────────────────────────

export function analyzeHoldSystemForRun(runId: string): {
  holdEnabled: boolean;
  baseHoldsPerRun: number;
  momentumThreshold: number;
  noHoldCordMultiplier: number;
  currentMomentum: number;
  bonusHoldsEarned: number;
} {
  const record = getRunRecord(runId);
  const behavior = getModeCardBehavior(record.mode);
  const holdCfg = HOLD_SYSTEM_CONFIG;
  const ledgerTimeline = buildLedgerTimeline(record);
  const momentum = computeMomentumScore(ledgerTimeline);

  const bonusHolds = momentum >= holdCfg.momentumThreshold ? holdCfg.bonusHoldsOnThreshold : 0;

  return {
    holdEnabled: behavior.holdEnabled,
    baseHoldsPerRun: holdCfg.baseHoldsPerRun,
    momentumThreshold: holdCfg.momentumThreshold,
    noHoldCordMultiplier: holdCfg.noHoldCordMultiplier,
    currentMomentum: momentum,
    bonusHoldsEarned: bonusHolds,
  };
}

export function analyzeComebackSurgeForRun(runId: string): {
  surgeAvailable: boolean;
  cashThresholdPct: number;
  emergencyCash: number;
  shieldBoostAll: number;
  heatFreezeTicks: number;
  currentCashPct: number;
} {
  const snapshot = getRunState(runId);
  const ledger = snapshot.ledger;
  const cfg = COMEBACK_SURGE_CONFIG;

  const maxCash = Math.max(ledger.cash + ledger.income * 10, 1);
  const currentCashPct = round6(ledger.cash / maxCash);
  const surgeAvailable = currentCashPct < cfg.cashThresholdPct;

  return {
    surgeAvailable,
    cashThresholdPct: cfg.cashThresholdPct,
    emergencyCash: cfg.emergencyCash,
    shieldBoostAll: cfg.shieldBoostAll,
    heatFreezeTicks: cfg.heatFreezeTicks,
    currentCashPct,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CARD DEFINITION HELPERS (for simulation)
// ─────────────────────────────────────────────────────────────────────────────

export function buildMockCardDefinition(
  cardId: string,
  deckType: DeckType,
  rarity: CardRarity,
  tags: readonly CardTag[],
  timingClasses: readonly TimingClass[],
  baseCost: number,
): CardDefinition {
  return {
    cardId,
    name: `Card_${cardId}`,
    deckType,
    baseCost,
    effects: [],
    tags: [...tags],
    timingClasses: [...timingClasses],
    rarity,
    autoResolve: false,
    counterability: 'NONE' as any,
    targeting: 'SELF' as any,
  };
}

export function computeMockCardEffectResult(
  card: CardDefinition,
  mode: GameMode,
  choiceId: string,
  appliedAt: number,
): CardEffectResult {
  const tags = card.tags as readonly CardTag[];
  const tagScore = computeTagWeightedScore(tags, mode);
  const profile = getDeckTypeProfile(card.deckType);
  const playHash = generateCardPlayHash(
    `play_${card.cardId}_${appliedAt}`,
    card.cardId,
    mode,
    appliedAt,
    choiceId,
    'mock_seed',
  );

  const resourceDelta: ResourceDelta = {
    cash: 0,
    income: 0,
    expense: 0,
    shield: 0,
    heat: profile.baselineHeat,
    trust: 0,
    divergence: 0,
    battleBudget: 0,
    treasury: 0,
  };

  return {
    playId: `play_${card.cardId}_${appliedAt}`,
    deterministicHash: playHash,
    cardInstanceId: `inst_${card.cardId}`,
    cardId: card.cardId,
    cardName: card.name,
    mode,
    choiceId,
    appliedAt,
    timingClass: card.timingClasses[0] ?? TimingClass.ANY,
    effectiveCost: card.baseCost,
    currencyUsed: 'cash' as CurrencyType,
    targeting: 'SELF' as any,
    effects: [],
    totalCordDelta: round6(tagScore * profile.baselineCordWeight),
    resourceDelta,
    drawCount: 0,
    injectedCardIds: [],
    statusesAdded: [],
    statusesRemoved: [],
    isOptimalChoice: tagScore > 3,
    educationalTag: card.educationalTag,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// FULL MODE MATRIX ANALYSIS
// ─────────────────────────────────────────────────────────────────────────────

export function computeFullModeMatrix(): Record<string, {
  mode: GameMode;
  legalDecks: DeckType[];
  deckCount: number;
  avgBaselineHeat: number;
  avgCordWeight: number;
  features: string[];
}> {
  const result: Record<string, any> = {};

  for (const mode of Object.values(GameMode)) {
    const legalDecks = [...CARD_LEGALITY_MATRIX[mode]];
    const behavior = MODE_CARD_BEHAVIORS[mode];

    let totalHeat = 0;
    let totalCord = 0;
    for (const dt of legalDecks) {
      const profile = DECK_TYPE_PROFILES[dt];
      totalHeat += profile.baselineHeat;
      totalCord += profile.baselineCordWeight;
    }

    const features: string[] = [];
    if (behavior.holdEnabled) features.push('hold');
    if (behavior.battleBudgetEnabled) features.push('battle_budget');
    if (behavior.trustEnabled) features.push('trust');
    if (behavior.ghostEnabled) features.push('ghost');
    if (behavior.rescueEnabled) features.push('rescue');
    if (behavior.counterWindowEnabled) features.push('counter_window');
    if (behavior.aidWindowEnabled) features.push('aid_window');

    result[mode] = {
      mode,
      legalDecks,
      deckCount: legalDecks.length,
      avgBaselineHeat: round6(totalHeat / Math.max(legalDecks.length, 1)),
      avgCordWeight: round6(totalCord / Math.max(legalDecks.length, 1)),
      features,
    };
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// TIMING CLASS ANALYSIS
// ─────────────────────────────────────────────────────────────────────────────

export function computeTimingClassAnalysis(): Record<string, {
  timingClass: TimingClass;
  legalInModes: GameMode[];
  isUniversal: boolean;
}> {
  const result: Record<string, any> = {};

  for (const tc of Object.values(TimingClass)) {
    const legalModes: GameMode[] = [];
    for (const mode of Object.values(GameMode)) {
      const behavior = getModeCardBehavior(mode);
      let legal = true;
      if (tc === TimingClass.CTR && !behavior.counterWindowEnabled) legal = false;
      if (tc === TimingClass.AID && !behavior.aidWindowEnabled) legal = false;
      if (tc === TimingClass.GBM && !behavior.ghostEnabled) legal = false;
      if (tc === TimingClass.RES && !behavior.rescueEnabled) legal = false;
      if (legal) legalModes.push(mode);
    }

    result[tc] = {
      timingClass: tc,
      legalInModes: legalModes,
      isUniversal: legalModes.length === Object.values(GameMode).length,
    };
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// GHOST MARKER ANALYSIS
// ─────────────────────────────────────────────────────────────────────────────

export function computeGhostMarkerAnalysis(ghostSeed: number, turns: number): {
  markers: readonly { turn: number; kind: GhostMarkerKind; cordBonus: number; shieldBonus: number }[];
  totalCordBonus: number;
  totalShieldBonus: number;
  markerFrequency: Record<string, number>;
} {
  const markers: { turn: number; kind: GhostMarkerKind; cordBonus: number; shieldBonus: number }[] = [];
  let totalCord = 0;
  let totalShield = 0;
  const freq: Record<string, number> = {};

  for (const kind of Object.values(GhostMarkerKind)) {
    freq[kind] = 0;
  }

  for (let t = 0; t < turns; t++) {
    const kind = resolveGhostMarkerForTurn(t, ghostSeed);
    if (kind) {
      const cordBonus = computeGhostMarkerCordBonus(kind);
      const shieldBonus = computeGhostMarkerShieldBonus(kind);
      markers.push({ turn: t, kind, cordBonus, shieldBonus });
      totalCord += cordBonus;
      totalShield += shieldBonus;
      freq[kind] = (freq[kind] ?? 0) + 1;
    }
  }

  return {
    markers,
    totalCordBonus: totalCord,
    totalShieldBonus: totalShield,
    markerFrequency: freq,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// RUN SUMMARY GENERATION
// ─────────────────────────────────────────────────────────────────────────────

export function generateRunSummary(runId: string): {
  runId: string;
  seed: number;
  mode: GameMode;
  turnCount: number;
  finalized: boolean;
  phase: RunPhase;
  pressureTier: PressureTier;
  trustBand: TrustBand;
  cordScore: number;
  grade: string;
  netWorth: number;
  survivalMargin: number;
  efficiency: number;
  momentum: number;
  warnings: string[];
} {
  const record = getRunRecord(runId);
  const snapshot = getRunState(runId);
  const ledger = snapshot.ledger;
  const grade = computeSovereigntyGrade(runId);
  const phase = determineRunPhase(ledger.turn);
  const pressureTier = determinePressureTier(ledger.heat, ledger.shield);
  const trustBand = determineTrustBand(ledger.trust);
  const ledgerTimeline = buildLedgerTimeline(record);
  const momentum = computeMomentumScore(ledgerTimeline);
  const warnings = validateModeConsistency(record.mode, ledger);

  return {
    runId,
    seed: record.seed,
    mode: record.mode,
    turnCount: snapshot.turnCount,
    finalized: record.finalized,
    phase,
    pressureTier,
    trustBand,
    cordScore: grade.cordScore,
    grade: grade.letter,
    netWorth: computeNetWorth(ledger),
    survivalMargin: computeSurvivalMargin(ledger),
    efficiency: computeEfficiencyRatio(ledger),
    momentum,
    warnings,
  };
}
