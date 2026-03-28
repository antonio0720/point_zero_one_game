/**
 * POINT ZERO ONE — DETERMINISTIC SEED GENERATOR v3.0.0
 * backend/src/game/engine/seed_generator.ts
 *
 * Full-depth seed infrastructure for deterministic run orchestration.
 * Provides: seed derivation, commitment, pools, chains, verification,
 * entropy analytics, ML/DL feature extraction, ghost comparison,
 * mode-aware profiles, chat bridge events, batch processing, and
 * import/export transport.
 *
 * Every subsystem (cards, battle, cascade, tension, pressure, shield,
 * sovereignty) receives its own deterministic RNG stream derived from
 * a master seed, ensuring reproducibility and auditability.
 */

import { createHash } from 'node:crypto';

import {
  DEFAULT_NON_ZERO_SEED,
  normalizeSeed,
  hashStringToSeed,
  combineSeed,
  createMulberry32,
  sanitizePositiveWeights,
  type DeterministicRng,
  createDeterministicRng,
} from './deterministic_rng';

import {
  GameMode,
  DeckType,
  CardRarity,
  RunPhase,
  PressureTier,
  TimingClass,
  GhostMarkerKind,
  CardTag,
  CARD_LEGALITY_MATRIX,
  MODE_TAG_WEIGHT_DEFAULTS,
  CARD_RARITY_DROP_RATES,
  HOLD_SYSTEM_CONFIG,
  COMEBACK_SURGE_CONFIG,
  clamp,
  round6,
  getDeckTypeProfile,
  getModeCardBehavior,
  computeTagWeightedScore,
} from './card_types';

import {
  sha256Hex,
  stableStringify,
  type Ledger,
  createDefaultLedger,
  ReplayEngine,
  GameState,
  type ReplaySnapshot,
  type DecisionEffect,
  type RunEvent,
} from './replay_engine';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

export const SEED_GENERATOR_VERSION = '3.0.0';

/** Number of ML feature dimensions extracted from a seed profile. */
const ML_FEATURE_DIMENSIONS = 24;

/** DL tensor rows (seed derivation paths across ticks). */
const DL_TENSOR_ROWS = 32;

/** DL tensor columns (subsystem features per row). */
const DL_TENSOR_COLS = 6;

/** Minimum acceptable Shannon entropy for a seed (bits). */
const MIN_ACCEPTABLE_ENTROPY = 2.5;

/** Chi-squared critical value for 255 degrees of freedom at p=0.05. */
const CHI_SQUARED_CRITICAL_255 = 293.25;

/** Default sample count for distribution analysis. */
const DEFAULT_DISTRIBUTION_SAMPLES = 10_000;

/** Maximum chain length for seed derivation chains. */
const MAX_CHAIN_LENGTH = 4096;

/** Correlation threshold above which seeds are considered related. */
const CORRELATION_WARNING_THRESHOLD = 0.85;

/** Entropy quality grade boundaries. */
const ENTROPY_GRADE_EXCELLENT = 3.5;
const ENTROPY_GRADE_GOOD = 3.0;
const ENTROPY_GRADE_ACCEPTABLE = 2.5;

/**
 * Subsystem namespace registry — each engine subsystem derives its seed
 * from the master seed using a unique namespace salt.
 */
const SUBSYSTEM_NAMESPACE_REGISTRY: Readonly<Record<string, string>> = {
  cards: 'pzo:subsys:cards:v3',
  battle: 'pzo:subsys:battle:v3',
  cascade: 'pzo:subsys:cascade:v3',
  tension: 'pzo:subsys:tension:v3',
  pressure: 'pzo:subsys:pressure:v3',
  shield: 'pzo:subsys:shield:v3',
  sovereignty: 'pzo:subsys:sovereignty:v3',
  ghost: 'pzo:subsys:ghost:v3',
  timing: 'pzo:subsys:timing:v3',
  deck_draw: 'pzo:subsys:deck_draw:v3',
  phase: 'pzo:subsys:phase:v3',
  mode: 'pzo:subsys:mode:v3',
};

/**
 * All timing classes enumerated for iteration.
 */
const ALL_TIMING_CLASSES: readonly TimingClass[] = [
  TimingClass.PRE, TimingClass.POST, TimingClass.FATE,
  TimingClass.CTR, TimingClass.RES, TimingClass.AID,
  TimingClass.GBM, TimingClass.CAS, TimingClass.PHZ,
  TimingClass.PSK, TimingClass.END, TimingClass.ANY,
];

/**
 * All game modes enumerated for iteration.
 */
const ALL_GAME_MODES: readonly GameMode[] = [
  GameMode.GO_ALONE, GameMode.HEAD_TO_HEAD,
  GameMode.TEAM_UP, GameMode.CHASE_A_LEGEND,
];

/**
 * All deck types enumerated for iteration.
 */
const ALL_DECK_TYPES: readonly DeckType[] = [
  DeckType.OPPORTUNITY, DeckType.IPA, DeckType.FUBAR,
  DeckType.MISSED_OPPORTUNITY, DeckType.PRIVILEGED, DeckType.SO,
  DeckType.SABOTAGE, DeckType.COUNTER, DeckType.AID,
  DeckType.RESCUE, DeckType.DISCIPLINE, DeckType.TRUST,
  DeckType.BLUFF, DeckType.GHOST,
];

/**
 * All card rarities enumerated for iteration.
 */
const ALL_CARD_RARITIES: readonly CardRarity[] = [
  CardRarity.COMMON, CardRarity.UNCOMMON,
  CardRarity.RARE, CardRarity.LEGENDARY,
];

/**
 * All run phases enumerated for iteration.
 */
const ALL_RUN_PHASES: readonly RunPhase[] = [
  RunPhase.FOUNDATION, RunPhase.ESCALATION, RunPhase.SOVEREIGNTY,
];

/**
 * All pressure tiers enumerated for iteration.
 */
const ALL_PRESSURE_TIERS: readonly PressureTier[] = [
  PressureTier.T0_SOVEREIGN, PressureTier.T1_STABLE,
  PressureTier.T2_STRESSED, PressureTier.T3_ELEVATED,
  PressureTier.T4_COLLAPSE_IMMINENT,
];

/**
 * All ghost marker kinds enumerated for iteration.
 */
const ALL_GHOST_MARKER_KINDS: readonly GhostMarkerKind[] = [
  GhostMarkerKind.GOLD_BUY, GhostMarkerKind.RED_PASS,
  GhostMarkerKind.PURPLE_POWER, GhostMarkerKind.SILVER_BREACH,
  GhostMarkerKind.BLACK_CASCADE,
];

/**
 * All card tags enumerated for iteration.
 */
const ALL_CARD_TAGS: readonly CardTag[] = [
  CardTag.LIQUIDITY, CardTag.INCOME, CardTag.RESILIENCE,
  CardTag.SCALE, CardTag.TEMPO, CardTag.SABOTAGE,
  CardTag.COUNTER, CardTag.HEAT, CardTag.TRUST,
  CardTag.AID, CardTag.PRECISION, CardTag.DIVERGENCE,
  CardTag.VARIANCE, CardTag.CASCADE, CardTag.MOMENTUM,
];

// ─────────────────────────────────────────────────────────────────────────────
// INTERFACES
// ─────────────────────────────────────────────────────────────────────────────

export interface SeedMaterial {
  readonly runId: string | number;
  readonly namespace?: string;
  readonly mode?: string;
  readonly salt?: string | number;
}

export interface SeedCommitment {
  readonly seed: number;
  readonly seedHex: string;
  readonly commitment: string;
  readonly canonicalMaterial: string;
}

export interface SeedPoolConfig {
  readonly masterSeed: number;
  readonly subsystems: readonly string[];
  readonly tickCapacity: number;
  readonly precomputeDepth: number;
}

export interface SeedPoolSubsystemState {
  readonly subsystem: string;
  readonly namespaceSalt: string;
  readonly derivedSeed: number;
  readonly ticksConsumed: number;
  readonly lastGeneratedValue: number;
  readonly cumulativeHash: string;
}

export interface SeedPool {
  readonly masterSeed: number;
  readonly version: string;
  readonly createdAt: number;
  readonly subsystemStates: Record<string, SeedPoolSubsystemState>;
  readonly globalTickCounter: number;
  readonly poolIntegrityHash: string;
}

export interface SeedChainLink {
  readonly index: number;
  readonly seed: number;
  readonly seedHex: string;
  readonly parentHash: string;
  readonly linkHash: string;
  readonly derivationPath: string;
}

export interface SeedChain {
  readonly masterSeed: number;
  readonly length: number;
  readonly links: readonly SeedChainLink[];
  readonly chainHash: string;
  readonly createdAt: number;
}

export interface SeedVerificationResult {
  readonly valid: boolean;
  readonly seedMatches: boolean;
  readonly commitmentMatches: boolean;
  readonly replayConsistent: boolean;
  readonly ledgerDrift: number;
  readonly maxDivergence: number;
  readonly turnCount: number;
  readonly details: string;
  readonly proofHash: string;
}

export interface SeedEntropyAnalysis {
  readonly seed: number;
  readonly shannonEntropy: number;
  readonly bitDistribution: readonly number[];
  readonly chiSquaredStatistic: number;
  readonly chiSquaredPassed: boolean;
  readonly entropyGrade: 'EXCELLENT' | 'GOOD' | 'ACCEPTABLE' | 'POOR';
  readonly monobitBalance: number;
  readonly longestRun: number;
  readonly byteFrequencies: readonly number[];
  readonly avalancheScore: number;
}

export interface SeedDistributionReport {
  readonly sampleCount: number;
  readonly mean: number;
  readonly variance: number;
  readonly standardDeviation: number;
  readonly skewness: number;
  readonly kurtosis: number;
  readonly min: number;
  readonly max: number;
  readonly bucketCounts: readonly number[];
  readonly bucketSize: number;
  readonly uniformityScore: number;
}

export interface SeedCorrelationResult {
  readonly seedA: number;
  readonly seedB: number;
  readonly pearsonR: number;
  readonly sampleCount: number;
  readonly isCorrelated: boolean;
  readonly warningLevel: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface SeedQualityReport {
  readonly seed: number;
  readonly entropy: SeedEntropyAnalysis;
  readonly distribution: SeedDistributionReport;
  readonly overallGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  readonly recommendations: readonly string[];
}

export interface SeedMLFeatureVector {
  readonly seed: number;
  readonly dimensions: number;
  readonly features: readonly number[];
  readonly featureLabels: readonly string[];
  readonly modeAffinity: Record<string, number>;
  readonly phaseAffinity: Record<string, number>;
  readonly deckDrawBias: Record<string, number>;
  readonly tagWeightedScores: Record<string, number>;
  readonly entropyNormalized: number;
  readonly bitBalanceNormalized: number;
}

export interface SeedDLTensor {
  readonly seed: number;
  readonly rows: number;
  readonly cols: number;
  readonly data: readonly (readonly number[])[];
  readonly rowLabels: readonly string[];
  readonly colLabels: readonly string[];
  readonly tensorHash: string;
}

export interface SeedSubsystemDerivation {
  readonly subsystem: string;
  readonly masterSeed: number;
  readonly derivedSeed: number;
  readonly namespaceSalt: string;
  readonly derivationHash: string;
  readonly rngStreamSample: readonly number[];
}

export interface SeedBatchResult {
  readonly batchId: string;
  readonly seeds: readonly SeedCommitment[];
  readonly batchHash: string;
  readonly entropyReport: {
    readonly meanEntropy: number;
    readonly minEntropy: number;
    readonly maxEntropy: number;
    readonly failedCount: number;
  };
  readonly generatedAt: number;
}

export interface SeedModeProfile {
  readonly mode: GameMode;
  readonly masterSeed: number;
  readonly legalDeckTypes: readonly DeckType[];
  readonly deckDrawWeights: Record<string, number>;
  readonly tagInfluenceScores: Record<string, number>;
  readonly holdSystemAdjustment: number;
  readonly comebackSurgeThreshold: number;
  readonly battleBudgetEnabled: boolean;
  readonly trustEnabled: boolean;
  readonly ghostEnabled: boolean;
  readonly rescueEnabled: boolean;
  readonly counterWindowEnabled: boolean;
  readonly aidWindowEnabled: boolean;
  readonly phaseGatingSensitivity: number;
  readonly defaultChannel: string;
  readonly stageMood: string;
  readonly seedDerivedPhaseBias: Record<string, number>;
  readonly pressureTierSeedOffsets: Record<string, number>;
}

export interface SeedGhostComparison {
  readonly playerSeed: number;
  readonly legendSeed: number;
  readonly divergenceScore: number;
  readonly markerAlignments: Record<string, number>;
  readonly overallAlignment: number;
  readonly phaseByPhaseDivergence: Record<string, number>;
  readonly tagDivergence: Record<string, number>;
  readonly recommendation: string;
}

export interface SeedChatBridgeEvent {
  readonly eventType: 'SEED_COMMITTED' | 'SEED_VERIFIED' | 'SEED_ANOMALY' | 'SEED_POOL_ADVANCED' | 'SEED_CHAIN_EXTENDED';
  readonly timestamp: number;
  readonly seed: number;
  readonly payload: Record<string, unknown>;
  readonly humanReadable: string;
}

export interface SeedDeckDrawState {
  readonly deckType: DeckType;
  readonly drawSeed: number;
  readonly drawIndex: number;
  readonly rarityRoll: number;
  readonly selectedRarity: CardRarity;
  readonly cordWeightContribution: number;
  readonly heatContribution: number;
}

export interface SeedPhaseDerivation {
  readonly phase: RunPhase;
  readonly phaseSeed: number;
  readonly phaseOffset: number;
  readonly pressureTierModifier: number;
  readonly holdAdjustment: number;
  readonly derivationHash: string;
}

export interface SeedRunProfile {
  readonly runId: string;
  readonly masterSeed: number;
  readonly mode: GameMode;
  readonly modeProfile: SeedModeProfile;
  readonly phaseDerivations: readonly SeedPhaseDerivation[];
  readonly subsystemDerivations: readonly SeedSubsystemDerivation[];
  readonly entropyAnalysis: SeedEntropyAnalysis;
  readonly commitment: SeedCommitment;
  readonly poolState: SeedPool;
  readonly version: string;
  readonly exportedAt: number;
}

export interface SeedTimingPoolEntry {
  readonly timingClass: TimingClass;
  readonly derivedSeed: number;
  readonly windowSpecificRng: DeterministicRng;
  readonly consumedCount: number;
}

export interface SeedPressureDerivation {
  readonly tier: PressureTier;
  readonly tierSeed: number;
  readonly tierOffset: number;
  readonly costModifierSeed: number;
  readonly escalationBias: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Converts SeedMaterial into a canonical string for deterministic hashing.
 * This is the single authoritative serialization path for seed material.
 */
function toCanonicalMaterial(material: SeedMaterial): string {
  const namespace = material.namespace ?? 'pzo';
  const mode = material.mode ?? 'default';
  const salt = material.salt === undefined ? 'none' : String(material.salt);

  return [
    `namespace=${namespace}`,
    `mode=${mode}`,
    `runId=${String(material.runId)}`,
    `salt=${salt}`,
  ].join('|');
}

/**
 * Computes Shannon entropy of a 32-bit seed by analyzing its byte distribution.
 * Returns a value between 0 (no entropy) and 4 (maximum for 4 bytes).
 */
function computeSeedEntropy(seed: number): number {
  const bytes = [
    (seed >>> 24) & 0xff,
    (seed >>> 16) & 0xff,
    (seed >>> 8) & 0xff,
    seed & 0xff,
  ];

  const freq = new Array<number>(256).fill(0);
  for (const b of bytes) {
    freq[b] += 1;
  }

  let entropy = 0;
  const total = bytes.length;
  for (let i = 0; i < 256; i++) {
    if (freq[i] > 0) {
      const p = freq[i] / total;
      entropy -= p * Math.log2(p);
    }
  }

  return round6(entropy);
}

/**
 * Builds a sha256 hash of a seed combined with an arbitrary context string.
 * Uses node:crypto createHash directly for integrity verification.
 */
function buildSeedHash(seed: number, context: string): string {
  const input = `${seed.toString(16).padStart(8, '0')}:${context}`;
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * Derives a single link in a seed chain from the previous link's hash.
 * Each link's seed is derived deterministically from the parent hash.
 */
function deriveSeedChainLink(
  index: number,
  parentHash: string,
  derivationPath: string,
): SeedChainLink {
  const combinedInput = `${parentHash}:${derivationPath}:${index}`;
  const linkSeed = hashStringToSeed(combinedInput);
  const normalizedSeed = normalizeSeed(linkSeed);
  const seedHex = normalizedSeed.toString(16).padStart(8, '0');
  const linkHash = sha256Hex(`${parentHash}:${seedHex}:${index}`);

  return {
    index,
    seed: normalizedSeed,
    seedHex,
    parentHash,
    linkHash,
    derivationPath,
  };
}

/**
 * Computes distribution bias of a seed's RNG stream over N samples.
 * Returns a value between 0 (perfectly uniform) and 1 (maximally biased).
 */
function computeSeedDistributionBias(seed: number, samples: number, buckets: number): number {
  const rng = createDeterministicRng(seed);
  const counts = new Array<number>(buckets).fill(0);
  const expected = samples / buckets;

  for (let i = 0; i < samples; i++) {
    const bucket = Math.floor(rng.next() * buckets);
    const clampedBucket = clamp(bucket, 0, buckets - 1);
    counts[clampedBucket] += 1;
  }

  let totalDeviation = 0;
  for (let i = 0; i < buckets; i++) {
    totalDeviation += Math.abs(counts[i] - expected);
  }

  const maxPossibleDeviation = 2 * (samples - expected);
  const bias = maxPossibleDeviation > 0
    ? round6(totalDeviation / maxPossibleDeviation)
    : 0;
  return clamp(bias, 0, 1);
}

/**
 * Converts a 32-bit seed to a float in [0, 1).
 * Uses the same normalization as createMulberry32's first output.
 */
function seedToFloat(seed: number): number {
  const normalized = normalizeSeed(seed);
  return (normalized >>> 0) / 4294967296;
}

/**
 * Maps a seed deterministically to an integer in [min, max).
 */
function seedToRange(seed: number, min: number, max: number): number {
  const f = seedToFloat(seed);
  return clamp(Math.floor(min + f * (max - min)), min, max - 1);
}

/**
 * Computes a fingerprint of a seed's bit distribution.
 * Returns an array of 32 values, each being the bit value at that position.
 */
function computeSeedFingerprintBits(seed: number): readonly number[] {
  const bits: number[] = [];
  for (let i = 31; i >= 0; i--) {
    bits.push((seed >>> i) & 1);
  }
  return bits;
}

/**
 * Assesses the entropy quality of a seed and returns a grade.
 */
function assessEntropyQuality(
  shannonEntropy: number,
  chiSquaredPassed: boolean,
  monobitBalance: number,
): 'EXCELLENT' | 'GOOD' | 'ACCEPTABLE' | 'POOR' {
  if (shannonEntropy >= ENTROPY_GRADE_EXCELLENT && chiSquaredPassed && monobitBalance > 0.4) {
    return 'EXCELLENT';
  }
  if (shannonEntropy >= ENTROPY_GRADE_GOOD && monobitBalance > 0.35) {
    return 'GOOD';
  }
  if (shannonEntropy >= ENTROPY_GRADE_ACCEPTABLE) {
    return 'ACCEPTABLE';
  }
  return 'POOR';
}

/**
 * Computes the monobit balance of a 32-bit seed.
 * Returns the fraction of set bits (ideally 0.5 for balanced).
 */
function computeMonobitBalance(seed: number): number {
  let count = 0;
  for (let i = 0; i < 32; i++) {
    if ((seed >>> i) & 1) {
      count++;
    }
  }
  return round6(count / 32);
}

/**
 * Computes the longest run of identical bits in a 32-bit seed.
 */
function computeLongestBitRun(seed: number): number {
  let maxRun = 0;
  let currentRun = 1;
  let prevBit = seed & 1;

  for (let i = 1; i < 32; i++) {
    const bit = (seed >>> i) & 1;
    if (bit === prevBit) {
      currentRun++;
    } else {
      maxRun = Math.max(maxRun, currentRun);
      currentRun = 1;
    }
    prevBit = bit;
  }
  return Math.max(maxRun, currentRun);
}

/**
 * Computes the avalanche score: how much a single-bit flip changes the
 * hash output. Ideal is 0.5 (50% of output bits change).
 */
function computeAvalancheScore(seed: number): number {
  let totalFlipped = 0;
  const totalBitsChecked = 32 * 32;

  for (let bitPos = 0; bitPos < 32; bitPos++) {
    const flippedSeed = seed ^ (1 << bitPos);
    const derived = combineSeed(seed, bitPos);
    const derivedFlipped = combineSeed(flippedSeed, bitPos);
    const diff = derived ^ derivedFlipped;

    for (let j = 0; j < 32; j++) {
      if ((diff >>> j) & 1) {
        totalFlipped++;
      }
    }
  }

  return round6(totalFlipped / totalBitsChecked);
}

/**
 * Computes byte-level frequency analysis across N samples from a seeded RNG.
 */
function computeByteFrequencies(seed: number, sampleCount: number): readonly number[] {
  const freq = new Array<number>(256).fill(0);
  const rng = createMulberry32(seed);

  for (let i = 0; i < sampleCount; i++) {
    const val = rng();
    const byteVal = Math.floor(val * 256);
    const clamped = clamp(byteVal, 0, 255);
    freq[clamped] += 1;
  }

  return freq;
}

/**
 * Computes chi-squared statistic for byte-frequency uniformity.
 */
function computeChiSquared(frequencies: readonly number[], expectedPerBucket: number): number {
  let chiSq = 0;
  for (let i = 0; i < frequencies.length; i++) {
    const diff = frequencies[i] - expectedPerBucket;
    chiSq += (diff * diff) / Math.max(expectedPerBucket, 1);
  }
  return round6(chiSq);
}

/**
 * Derive a subsystem seed from a master seed + subsystem namespace.
 */
function deriveSubsystemSeedInternal(masterSeed: number, subsystem: string): number {
  const namespaceSalt = SUBSYSTEM_NAMESPACE_REGISTRY[subsystem] ?? `pzo:subsys:${subsystem}:v3`;
  return combineSeed(masterSeed, namespaceSalt);
}

/**
 * Derive a tick-specific seed by mixing subsystem seed with tick index.
 */
function deriveTickSeedInternal(subsystemSeed: number, tick: number): number {
  return combineSeed(subsystemSeed, `tick:${tick}`);
}

/**
 * Compute a cumulative hash for pool integrity verification.
 */
function computePoolIntegrityHash(states: Record<string, SeedPoolSubsystemState>): string {
  const keys = Object.keys(states).sort();
  const parts: string[] = [];
  for (const key of keys) {
    const st = states[key];
    parts.push(`${key}:${st.derivedSeed}:${st.ticksConsumed}:${st.lastGeneratedValue}`);
  }
  return sha256Hex(parts.join('|'));
}

/**
 * Converts a rarity into a weight using CARD_RARITY_DROP_RATES.
 */
function rarityToWeight(rarity: CardRarity): number {
  return CARD_RARITY_DROP_RATES[rarity];
}

/**
 * Builds an array of rarity weights in enumeration order.
 */
function buildRarityWeightArray(): number[] {
  return ALL_CARD_RARITIES.map(rarityToWeight);
}

/**
 * Selects a rarity from a RNG roll using drop rates.
 */
function selectRarityFromRoll(roll: number): CardRarity {
  let cumulative = 0;
  for (const rarity of ALL_CARD_RARITIES) {
    cumulative += CARD_RARITY_DROP_RATES[rarity];
    if (roll < cumulative) {
      return rarity;
    }
  }
  return CardRarity.COMMON;
}

/**
 * Computes deck draw weights for a specific mode, sanitized and normalized.
 */
function computeDeckDrawWeightsForMode(mode: GameMode, seed: number): Record<string, number> {
  const legalDecks = CARD_LEGALITY_MATRIX[mode];
  const result: Record<string, number> = {};
  const rng = createDeterministicRng(combineSeed(seed, 'deck_draw_weights'));

  const rawWeights: number[] = [];
  for (const deckType of legalDecks) {
    const profile = getDeckTypeProfile(deckType);
    const baseWeight = profile.baselineCordWeight * profile.drawRateMultiplier;
    const noiseAdjust = 1.0 + (rng.next() - 0.5) * 0.1;
    rawWeights.push(baseWeight * noiseAdjust);
  }

  const sanitized = sanitizePositiveWeights(rawWeights);
  const totalWeight = sanitized.reduce((s, w) => s + w, 0);

  for (let i = 0; i < legalDecks.length; i++) {
    const normalized = totalWeight > 0 ? round6(sanitized[i] / totalWeight) : 0;
    result[legalDecks[i]] = normalized;
  }

  return result;
}

/**
 * Computes tag influence scores for a mode based on MODE_TAG_WEIGHT_DEFAULTS.
 */
function computeTagInfluenceForMode(mode: GameMode): Record<string, number> {
  const modeWeights = MODE_TAG_WEIGHT_DEFAULTS[mode];
  const result: Record<string, number> = {};
  let totalWeight = 0;

  for (const tag of ALL_CARD_TAGS) {
    totalWeight += modeWeights[tag];
  }

  for (const tag of ALL_CARD_TAGS) {
    result[tag] = totalWeight > 0 ? round6(modeWeights[tag] / totalWeight) : 0;
  }

  return result;
}

/**
 * Computes phase bias based on seed derivation for each phase.
 */
function computePhaseBias(seed: number): Record<string, number> {
  const result: Record<string, number> = {};
  for (const phase of ALL_RUN_PHASES) {
    const phaseSeed = combineSeed(seed, `phase:${phase}`);
    result[phase] = round6(seedToFloat(phaseSeed));
  }
  return result;
}

/**
 * Computes pressure tier seed offsets.
 */
function computePressureTierOffsets(seed: number): Record<string, number> {
  const result: Record<string, number> = {};
  for (const tier of ALL_PRESSURE_TIERS) {
    const tierSeed = combineSeed(seed, `pressure:${tier}`);
    result[tier] = normalizeSeed(tierSeed);
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE PUBLIC API (preserved signatures)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Derives a numeric seed from SeedMaterial deterministically.
 * This is the canonical seed derivation function — all other seed
 * derivation paths should route through this or use combineSeed directly.
 */
export function deriveNumericSeed(material: SeedMaterial): number {
  const canonicalMaterial = toCanonicalMaterial(material);
  const baseSeed = hashStringToSeed(canonicalMaterial);

  if (material.salt === undefined) {
    return normalizeSeed(baseSeed);
  }

  return combineSeed(baseSeed, material.salt);
}

/**
 * Backward-compatible surface.
 * Returns a deterministic seed commitment string for the provided run ID.
 */
export function generateSeed(runId: number): string {
  return generateSeedCommitment({ runId }).commitment;
}

/**
 * Generates a full SeedCommitment including seed, hex representation,
 * commitment hash, and the canonical material string used for derivation.
 */
export function generateSeedCommitment(material: SeedMaterial): SeedCommitment {
  const canonicalMaterial = toCanonicalMaterial(material);
  const seed = deriveNumericSeed(material);
  const seedHex = seed.toString(16).padStart(8, '0');

  const commitment = createHash('sha256')
    .update(`${canonicalMaterial}|seedHex=${seedHex}`, 'utf8')
    .digest('hex');

  return {
    seed,
    seedHex,
    commitment,
    canonicalMaterial,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SEED POOL SYSTEM
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a new seed pool with per-subsystem RNG streams derived from
 * the master seed. Each subsystem gets a unique namespace salt so its
 * random stream is independent yet fully reproducible.
 */
export function createSeedPool(config: SeedPoolConfig): SeedPool {
  const subsystemStates: Record<string, SeedPoolSubsystemState> = {};

  for (const subsystem of config.subsystems) {
    const namespaceSalt = SUBSYSTEM_NAMESPACE_REGISTRY[subsystem]
      ?? `pzo:subsys:${subsystem}:v3`;
    const derivedSeed = combineSeed(config.masterSeed, namespaceSalt);

    subsystemStates[subsystem] = {
      subsystem,
      namespaceSalt,
      derivedSeed: normalizeSeed(derivedSeed),
      ticksConsumed: 0,
      lastGeneratedValue: 0,
      cumulativeHash: buildSeedHash(derivedSeed, `${subsystem}:init`),
    };
  }

  const poolIntegrityHash = computePoolIntegrityHash(subsystemStates);

  return {
    masterSeed: normalizeSeed(config.masterSeed),
    version: SEED_GENERATOR_VERSION,
    createdAt: Date.now(),
    subsystemStates,
    globalTickCounter: 0,
    poolIntegrityHash,
  };
}

/**
 * Advances a seed pool by one tick, generating the next random value
 * for each subsystem. Returns a new pool state (immutable pattern).
 */
export function advanceSeedPool(pool: SeedPool): SeedPool {
  const nextTick = pool.globalTickCounter + 1;
  const updatedStates: Record<string, SeedPoolSubsystemState> = {};

  for (const [subsystem, state] of Object.entries(pool.subsystemStates)) {
    const tickSeed = deriveTickSeedInternal(state.derivedSeed, nextTick);
    const rng = createDeterministicRng(tickSeed);
    const nextValue = rng.next();
    const roundedValue = round6(nextValue);

    const newCumulativeHash = sha256Hex(
      `${state.cumulativeHash}:${nextTick}:${tickSeed}:${roundedValue}`,
    );

    updatedStates[subsystem] = {
      subsystem: state.subsystem,
      namespaceSalt: state.namespaceSalt,
      derivedSeed: state.derivedSeed,
      ticksConsumed: state.ticksConsumed + 1,
      lastGeneratedValue: roundedValue,
      cumulativeHash: newCumulativeHash,
    };
  }

  const poolIntegrityHash = computePoolIntegrityHash(updatedStates);

  return {
    masterSeed: pool.masterSeed,
    version: pool.version,
    createdAt: pool.createdAt,
    subsystemStates: updatedStates,
    globalTickCounter: nextTick,
    poolIntegrityHash,
  };
}

/**
 * Returns a snapshot of the current seed pool state for a specific subsystem.
 * If the subsystem is not in the pool, returns null.
 */
export function getSeedPoolState(
  pool: SeedPool,
  subsystem: string,
): SeedPoolSubsystemState | null {
  return pool.subsystemStates[subsystem] ?? null;
}

/**
 * Resets a seed pool to its initial state, re-deriving all subsystem seeds
 * from the master seed. Preserves the pool configuration.
 */
export function resetSeedPool(pool: SeedPool): SeedPool {
  const subsystems = Object.keys(pool.subsystemStates);
  return createSeedPool({
    masterSeed: pool.masterSeed,
    subsystems,
    tickCapacity: 0,
    precomputeDepth: 0,
  });
}

/**
 * Creates a timing-class-specific seed pool where each TimingClass gets
 * its own RNG stream. Useful for ensuring timing windows have independent
 * randomness that doesn't interfere across subsystem boundaries.
 */
export function createTimingSeedPool(
  masterSeed: number,
): Record<string, SeedTimingPoolEntry> {
  const result: Record<string, SeedTimingPoolEntry> = {};

  for (const tc of ALL_TIMING_CLASSES) {
    const timingSalt = `timing_pool:${tc}`;
    const derivedSeed = combineSeed(masterSeed, timingSalt);
    const normalizedDerived = normalizeSeed(derivedSeed);

    result[tc] = {
      timingClass: tc,
      derivedSeed: normalizedDerived,
      windowSpecificRng: createDeterministicRng(normalizedDerived),
      consumedCount: 0,
    };
  }

  return result;
}

/**
 * Creates a pressure-tier-aware seed pool that adjusts derivation
 * offsets based on the current pressure tier. Higher pressure tiers
 * introduce more escalation bias into the seed stream.
 */
export function createPressureSeedDerivations(
  masterSeed: number,
): readonly SeedPressureDerivation[] {
  const results: SeedPressureDerivation[] = [];

  for (let tierIdx = 0; tierIdx < ALL_PRESSURE_TIERS.length; tierIdx++) {
    const tier = ALL_PRESSURE_TIERS[tierIdx];
    const tierSalt = `pressure_derive:${tier}:${tierIdx}`;
    const tierSeed = combineSeed(masterSeed, tierSalt);
    const normalizedTierSeed = normalizeSeed(tierSeed);

    const costModifierSeed = combineSeed(normalizedTierSeed, 'cost_modifier');
    const escalationBias = round6(tierIdx / (ALL_PRESSURE_TIERS.length - 1));
    const tierOffset = normalizedTierSeed % 65536;

    results.push({
      tier,
      tierSeed: normalizedTierSeed,
      tierOffset,
      costModifierSeed: normalizeSeed(costModifierSeed),
      escalationBias,
    });
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// SEED CHAIN & DERIVATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds a linked deterministic seed chain of the specified length.
 * Each link is derived from the previous link's hash, creating an
 * auditable chain where any modification invalidates all subsequent links.
 */
export function buildSeedChain(masterSeed: number, length: number): SeedChain {
  const effectiveLength = clamp(length, 1, MAX_CHAIN_LENGTH);
  const normalizedMaster = normalizeSeed(masterSeed);
  const links: SeedChainLink[] = [];

  let parentHash = sha256Hex(`chain_root:${normalizedMaster.toString(16)}`);

  for (let i = 0; i < effectiveLength; i++) {
    const derivationPath = `chain:${normalizedMaster}:link:${i}`;
    const link = deriveSeedChainLink(i, parentHash, derivationPath);
    links.push(link);
    parentHash = link.linkHash;
  }

  const chainHash = sha256Hex(
    links.map((l) => l.linkHash).join(':'),
  );

  return {
    masterSeed: normalizedMaster,
    length: effectiveLength,
    links,
    chainHash,
    createdAt: Date.now(),
  };
}

/**
 * Derives a subsystem-specific seed from the master seed.
 * Each subsystem uses SUBSYSTEM_NAMESPACE_REGISTRY for its salt.
 * Returns a full derivation record including a sample of the RNG stream.
 */
export function deriveSeedForSubsystem(
  masterSeed: number,
  subsystem: string,
  streamSampleSize: number = 10,
): SeedSubsystemDerivation {
  const namespaceSalt = SUBSYSTEM_NAMESPACE_REGISTRY[subsystem]
    ?? `pzo:subsys:${subsystem}:v3`;
  const derivedSeed = deriveSubsystemSeedInternal(masterSeed, subsystem);
  const normalizedDerived = normalizeSeed(derivedSeed);
  const derivationHash = buildSeedHash(normalizedDerived, `subsystem:${subsystem}`);

  const rng = createDeterministicRng(normalizedDerived);
  const rngStreamSample: number[] = [];
  for (let i = 0; i < streamSampleSize; i++) {
    rngStreamSample.push(round6(rng.next()));
  }

  return {
    subsystem,
    masterSeed: normalizeSeed(masterSeed),
    derivedSeed: normalizedDerived,
    namespaceSalt,
    derivationHash,
    rngStreamSample,
  };
}

/**
 * Derives a tick-specific seed for a given subsystem.
 * Combines the subsystem's derived seed with the tick index.
 */
export function deriveSeedForTick(
  masterSeed: number,
  subsystem: string,
  tick: number,
): number {
  const subsystemSeed = deriveSubsystemSeedInternal(masterSeed, subsystem);
  return normalizeSeed(deriveTickSeedInternal(subsystemSeed, tick));
}

/**
 * Derives a seed specifically for deck draw operations.
 * Uses the deck_draw subsystem, combined with the deck type and draw index,
 * to produce a unique seed for each card draw in a run.
 */
export function deriveSeedForDeckDraw(
  masterSeed: number,
  deckType: DeckType,
  drawIndex: number,
): SeedDeckDrawState {
  const drawSubsystemSeed = deriveSubsystemSeedInternal(masterSeed, 'deck_draw');
  const drawSpecificSeed = combineSeed(drawSubsystemSeed, `${deckType}:draw:${drawIndex}`);
  const normalizedDrawSeed = normalizeSeed(drawSpecificSeed);

  const rng = createDeterministicRng(normalizedDrawSeed);
  const rarityRoll = rng.next();
  const selectedRarity = selectRarityFromRoll(rarityRoll);

  const profile = getDeckTypeProfile(deckType);
  const cordWeightContribution = round6(profile.baselineCordWeight * CARD_RARITY_DROP_RATES[selectedRarity]);
  const heatContribution = round6(profile.baselineHeat * (1 + rarityRoll * 0.2));

  return {
    deckType,
    drawSeed: normalizedDrawSeed,
    drawIndex,
    rarityRoll: round6(rarityRoll),
    selectedRarity,
    cordWeightContribution,
    heatContribution,
  };
}

/**
 * Derives phase-specific seeds that account for run phase progression.
 * Each phase has its own seed offset, pressure tier modifier, and hold
 * adjustment derived from HOLD_SYSTEM_CONFIG.
 */
export function deriveSeedForPhase(
  masterSeed: number,
  phase: RunPhase,
  pressureTier: PressureTier,
): SeedPhaseDerivation {
  const phaseSeed = combineSeed(masterSeed, `phase:${phase}`);
  const normalizedPhaseSeed = normalizeSeed(phaseSeed);
  const phaseOffset = normalizedPhaseSeed % 10000;

  const pressureIndex = ALL_PRESSURE_TIERS.indexOf(pressureTier);
  const pressureTierModifier = round6(pressureIndex / (ALL_PRESSURE_TIERS.length - 1));

  const phaseIndex = ALL_RUN_PHASES.indexOf(phase);
  const holdExpiryChanges = HOLD_SYSTEM_CONFIG.holdExpiryPhaseChanges;
  const holdAdjustment = round6(
    phaseIndex >= holdExpiryChanges
      ? HOLD_SYSTEM_CONFIG.noHoldCordMultiplier
      : 1.0,
  );

  const derivationHash = sha256Hex(
    `phase:${phase}:pressure:${pressureTier}:seed:${normalizedPhaseSeed}`,
  );

  return {
    phase,
    phaseSeed: normalizedPhaseSeed,
    phaseOffset,
    pressureTierModifier,
    holdAdjustment,
    derivationHash,
  };
}

/**
 * Mode-aware seed derivation that uses CARD_LEGALITY_MATRIX and
 * getModeCardBehavior to produce a seed tailored to the mode's
 * specific deck composition and gameplay mechanics.
 */
export function deriveSeedForMode(
  masterSeed: number,
  mode: GameMode,
): number {
  const modeBehavior = getModeCardBehavior(mode);
  const legalDecks = CARD_LEGALITY_MATRIX[mode];

  let modeSalt = `mode:${mode}`;
  for (const deck of modeBehavior.primaryDeckTypes) {
    modeSalt += `:primary:${deck}`;
  }
  for (const deck of legalDecks) {
    modeSalt += `:legal:${deck}`;
  }

  if (modeBehavior.holdEnabled) modeSalt += ':hold';
  if (modeBehavior.battleBudgetEnabled) modeSalt += ':battle_budget';
  if (modeBehavior.trustEnabled) modeSalt += ':trust';
  if (modeBehavior.ghostEnabled) modeSalt += ':ghost';
  if (modeBehavior.rescueEnabled) modeSalt += ':rescue';
  if (modeBehavior.counterWindowEnabled) modeSalt += ':counter_window';
  if (modeBehavior.aidWindowEnabled) modeSalt += ':aid_window';

  modeSalt += `:channel:${modeBehavior.defaultChannel}`;
  modeSalt += `:mood:${modeBehavior.stageMood}`;

  return normalizeSeed(combineSeed(masterSeed, modeSalt));
}

/**
 * Builds a complete set of subsystem derivations for all registered subsystems.
 */
export function deriveAllSubsystemSeeds(
  masterSeed: number,
): readonly SeedSubsystemDerivation[] {
  const subsystems = Object.keys(SUBSYSTEM_NAMESPACE_REGISTRY);
  return subsystems.map((s) => deriveSeedForSubsystem(masterSeed, s));
}

/**
 * Derives seeds for all phases at a specific pressure tier.
 */
export function deriveAllPhaseSeeds(
  masterSeed: number,
  pressureTier: PressureTier,
): readonly SeedPhaseDerivation[] {
  return ALL_RUN_PHASES.map((phase) =>
    deriveSeedForPhase(masterSeed, phase, pressureTier),
  );
}

/**
 * Derives a batch of deck draw seeds for a given mode,
 * across all legal deck types for that mode.
 */
export function deriveDeckDrawSeedsForMode(
  masterSeed: number,
  mode: GameMode,
  drawsPerDeck: number,
): readonly SeedDeckDrawState[] {
  const legalDecks = CARD_LEGALITY_MATRIX[mode];
  const results: SeedDeckDrawState[] = [];

  for (const deckType of legalDecks) {
    for (let drawIdx = 0; drawIdx < drawsPerDeck; drawIdx++) {
      results.push(deriveSeedForDeckDraw(masterSeed, deckType, drawIdx));
    }
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// SEED VERIFICATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verifies that a seed produces consistent state when replayed through
 * a ReplayEngine with the given event log. Checks seed match, commitment
 * validity, and ledger consistency.
 */
export function verifySeedAgainstReplay(
  material: SeedMaterial,
  events: readonly RunEvent[],
): SeedVerificationResult {
  const commitment = generateSeedCommitment(material);
  const expectedSeed = commitment.seed;

  let seedMatches = true;
  let commitmentMatches = true;
  let replayConsistent = true;
  let ledgerDrift = 0;
  let maxDivergence = 0;
  let turnCount = 0;
  const details: string[] = [];

  const recomputedCommitment = generateSeedCommitment(material);
  if (recomputedCommitment.commitment !== commitment.commitment) {
    commitmentMatches = false;
    details.push('Commitment hash mismatch on recomputation');
  }

  if (recomputedCommitment.seed !== expectedSeed) {
    seedMatches = false;
    details.push(`Seed mismatch: expected ${expectedSeed}, got ${recomputedCommitment.seed}`);
  }

  if (events.length > 0) {
    const engine = new ReplayEngine(expectedSeed, events);
    const snapshot: ReplaySnapshot = engine.replayAll();
    turnCount = snapshot.turnCount;

    const freshState = new GameState(expectedSeed);
    for (const event of events) {
      freshState.applyEvent(event);
    }
    const freshSnapshot = freshState.snapshot();

    const fieldDrifts: number[] = [];
    const ledgerKeys: (keyof Ledger)[] = [
      'cash', 'income', 'expenses', 'shield',
      'heat', 'trust', 'divergence', 'cords',
    ];

    for (const key of ledgerKeys) {
      const snapshotVal = snapshot.ledger[key];
      const freshVal = freshSnapshot.ledger[key];
      const drift = Math.abs(snapshotVal - freshVal);
      fieldDrifts.push(drift);
      if (drift > maxDivergence) {
        maxDivergence = drift;
      }
    }

    ledgerDrift = round6(fieldDrifts.reduce((s, d) => s + d, 0));

    if (ledgerDrift > 0.000001) {
      replayConsistent = false;
      details.push(`Ledger drift detected: total=${ledgerDrift}, max field divergence=${maxDivergence}`);
    }

    if (snapshot.turnCount !== freshSnapshot.turnCount) {
      replayConsistent = false;
      details.push(`Turn count mismatch: engine=${snapshot.turnCount}, fresh=${freshSnapshot.turnCount}`);
    }
  }

  const valid = seedMatches && commitmentMatches && replayConsistent;
  const proofPayload = stableStringify({
    seed: expectedSeed,
    commitment: commitment.commitment,
    valid,
    ledgerDrift,
    turnCount,
  });
  const proofHash = sha256Hex(proofPayload);

  return {
    valid,
    seedMatches,
    commitmentMatches,
    replayConsistent,
    ledgerDrift,
    maxDivergence: round6(maxDivergence),
    turnCount,
    details: details.length > 0 ? details.join('; ') : 'All checks passed',
    proofHash,
  };
}

/**
 * Verifies that a seed chain is internally consistent — each link's
 * parent hash must match the previous link's link hash.
 */
export function verifySeedCommitmentChain(chain: SeedChain): boolean {
  if (chain.links.length === 0) return false;

  const expectedRootHash = sha256Hex(
    `chain_root:${chain.masterSeed.toString(16)}`,
  );

  if (chain.links[0].parentHash !== expectedRootHash) {
    return false;
  }

  for (let i = 1; i < chain.links.length; i++) {
    if (chain.links[i].parentHash !== chain.links[i - 1].linkHash) {
      return false;
    }
  }

  const recomputedChainHash = sha256Hex(
    chain.links.map((l) => l.linkHash).join(':'),
  );

  return recomputedChainHash === chain.chainHash;
}

/**
 * Validates the overall integrity of a seed by checking normalization
 * stability, entropy quality, and bit distribution.
 */
export function validateSeedIntegrity(seed: number): {
  readonly valid: boolean;
  readonly normalizes: boolean;
  readonly entropyOk: boolean;
  readonly monobitOk: boolean;
  readonly details: string;
} {
  const normalizedSeed = normalizeSeed(seed);
  const normalizes = normalizedSeed === normalizeSeed(normalizedSeed);

  const entropy = computeSeedEntropy(normalizedSeed);
  const entropyOk = entropy >= MIN_ACCEPTABLE_ENTROPY;

  const monobit = computeMonobitBalance(normalizedSeed);
  const monobitOk = monobit >= 0.25 && monobit <= 0.75;

  const valid = normalizes && entropyOk && monobitOk;
  const details = valid
    ? `Seed ${normalizedSeed.toString(16)} passes all integrity checks`
    : `Seed ${normalizedSeed.toString(16)} failed: normalizes=${normalizes}, entropy=${entropy} (min=${MIN_ACCEPTABLE_ENTROPY}), monobit=${monobit}`;

  return { valid, normalizes, entropyOk, monobitOk, details };
}

/**
 * Computes a cryptographic proof hash for a seed and its associated
 * commitment, suitable for audit trail inclusion.
 */
export function computeSeedProofHash(
  material: SeedMaterial,
  additionalContext: string = '',
): string {
  const commitment = generateSeedCommitment(material);
  const proofInput = stableStringify({
    seed: commitment.seed,
    seedHex: commitment.seedHex,
    commitment: commitment.commitment,
    canonicalMaterial: commitment.canonicalMaterial,
    context: additionalContext,
    version: SEED_GENERATOR_VERSION,
  });
  return sha256Hex(proofInput);
}

// ─────────────────────────────────────────────────────────────────────────────
// SEED ANALYTICS & ENTROPY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Performs a comprehensive entropy analysis of a seed.
 * Computes Shannon entropy, bit distribution, chi-squared uniformity test,
 * monobit balance, longest run, byte frequencies, and avalanche score.
 */
export function analyzeSeedEntropy(seed: number): SeedEntropyAnalysis {
  const normalizedSeed = normalizeSeed(seed);
  const shannonEntropy = computeSeedEntropy(normalizedSeed);
  const bitDistribution = computeSeedFingerprintBits(normalizedSeed);
  const monobitBalance = computeMonobitBalance(normalizedSeed);
  const longestRun = computeLongestBitRun(normalizedSeed);
  const avalancheScore = computeAvalancheScore(normalizedSeed);

  const byteFrequencies = computeByteFrequencies(normalizedSeed, 1024);
  const expectedPerBucket = 1024 / 256;
  const chiSquaredStatistic = computeChiSquared(byteFrequencies, expectedPerBucket);
  const chiSquaredPassed = chiSquaredStatistic <= CHI_SQUARED_CRITICAL_255;

  const entropyGrade = assessEntropyQuality(shannonEntropy, chiSquaredPassed, monobitBalance);

  return {
    seed: normalizedSeed,
    shannonEntropy,
    bitDistribution,
    chiSquaredStatistic,
    chiSquaredPassed,
    entropyGrade,
    monobitBalance,
    longestRun,
    byteFrequencies,
    avalancheScore,
  };
}

/**
 * Tests the output distribution of a seed's RNG stream over N samples.
 * Computes statistical measures: mean, variance, skewness, kurtosis,
 * and a uniformity score based on bucket analysis.
 */
export function analyzeSeedDistribution(
  seed: number,
  sampleCount: number = DEFAULT_DISTRIBUTION_SAMPLES,
  bucketCount: number = 100,
): SeedDistributionReport {
  const rng = createDeterministicRng(normalizeSeed(seed));
  const samples: number[] = [];

  for (let i = 0; i < sampleCount; i++) {
    samples.push(rng.next());
  }

  let sum = 0;
  let min = Infinity;
  let max = -Infinity;

  for (const s of samples) {
    sum += s;
    if (s < min) min = s;
    if (s > max) max = s;
  }

  const mean = round6(sum / sampleCount);

  let varianceSum = 0;
  let skewnessSum = 0;
  let kurtosisSum = 0;

  for (const s of samples) {
    const diff = s - mean;
    varianceSum += diff * diff;
    skewnessSum += diff * diff * diff;
    kurtosisSum += diff * diff * diff * diff;
  }

  const variance = round6(varianceSum / sampleCount);
  const standardDeviation = round6(Math.sqrt(variance));

  const skewness = standardDeviation > 0
    ? round6((skewnessSum / sampleCount) / (standardDeviation * standardDeviation * standardDeviation))
    : 0;

  const kurtosis = variance > 0
    ? round6((kurtosisSum / sampleCount) / (variance * variance) - 3)
    : 0;

  const bucketCounts = new Array<number>(bucketCount).fill(0);
  for (const s of samples) {
    const bucket = clamp(Math.floor(s * bucketCount), 0, bucketCount - 1);
    bucketCounts[bucket] += 1;
  }

  const expectedPerBucket = sampleCount / bucketCount;
  let deviationSum = 0;
  for (const c of bucketCounts) {
    deviationSum += Math.abs(c - expectedPerBucket);
  }
  const uniformityScore = round6(1 - deviationSum / (2 * sampleCount));

  return {
    sampleCount,
    mean,
    variance,
    standardDeviation,
    skewness,
    kurtosis,
    min: round6(min),
    max: round6(max),
    bucketCounts,
    bucketSize: round6(1 / bucketCount),
    uniformityScore,
  };
}

/**
 * Computes Pearson correlation between two seeds' RNG output streams.
 * High correlation (>0.85) suggests the seeds are insufficiently independent.
 */
export function computeSeedCorrelation(
  seedA: number,
  seedB: number,
  sampleCount: number = 1000,
): SeedCorrelationResult {
  const rngA = createDeterministicRng(normalizeSeed(seedA));
  const rngB = createDeterministicRng(normalizeSeed(seedB));

  const valuesA: number[] = [];
  const valuesB: number[] = [];

  for (let i = 0; i < sampleCount; i++) {
    valuesA.push(rngA.next());
    valuesB.push(rngB.next());
  }

  let sumA = 0, sumB = 0;
  for (let i = 0; i < sampleCount; i++) {
    sumA += valuesA[i];
    sumB += valuesB[i];
  }
  const meanA = sumA / sampleCount;
  const meanB = sumB / sampleCount;

  let covariance = 0;
  let varA = 0;
  let varB = 0;

  for (let i = 0; i < sampleCount; i++) {
    const dA = valuesA[i] - meanA;
    const dB = valuesB[i] - meanB;
    covariance += dA * dB;
    varA += dA * dA;
    varB += dB * dB;
  }

  const denominator = Math.sqrt(varA * varB);
  const pearsonR = denominator > 0
    ? round6(covariance / denominator)
    : 0;

  const absPearson = Math.abs(pearsonR);
  let warningLevel: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' = 'NONE';
  if (absPearson >= CORRELATION_WARNING_THRESHOLD) {
    warningLevel = 'HIGH';
  } else if (absPearson >= 0.6) {
    warningLevel = 'MEDIUM';
  } else if (absPearson >= 0.3) {
    warningLevel = 'LOW';
  }

  return {
    seedA: normalizeSeed(seedA),
    seedB: normalizeSeed(seedB),
    pearsonR,
    sampleCount,
    isCorrelated: absPearson >= CORRELATION_WARNING_THRESHOLD,
    warningLevel,
  };
}

/**
 * Produces a comprehensive quality report for a seed combining
 * entropy analysis, distribution analysis, and an overall grade.
 */
export function getSeedQualityReport(seed: number): SeedQualityReport {
  const normalizedSeed = normalizeSeed(seed);
  const entropy = analyzeSeedEntropy(normalizedSeed);
  const distribution = analyzeSeedDistribution(normalizedSeed, 5000, 50);

  const recommendations: string[] = [];
  let gradePoints = 0;

  if (entropy.entropyGrade === 'EXCELLENT') gradePoints += 4;
  else if (entropy.entropyGrade === 'GOOD') gradePoints += 3;
  else if (entropy.entropyGrade === 'ACCEPTABLE') gradePoints += 2;
  else {
    gradePoints += 1;
    recommendations.push('Seed has low Shannon entropy — consider re-deriving with additional salt');
  }

  if (distribution.uniformityScore >= 0.95) gradePoints += 4;
  else if (distribution.uniformityScore >= 0.90) gradePoints += 3;
  else if (distribution.uniformityScore >= 0.80) gradePoints += 2;
  else {
    gradePoints += 1;
    recommendations.push('Distribution uniformity is poor — RNG output may exhibit clustering');
  }

  if (entropy.chiSquaredPassed) gradePoints += 2;
  else recommendations.push('Chi-squared test failed — byte frequencies deviate from uniform');

  if (entropy.avalancheScore >= 0.4 && entropy.avalancheScore <= 0.6) gradePoints += 2;
  else recommendations.push(`Avalanche score ${entropy.avalancheScore} deviates from ideal 0.5`);

  if (entropy.longestRun <= 8) gradePoints += 1;
  else recommendations.push(`Longest bit run of ${entropy.longestRun} exceeds threshold`);

  const totalMaxPoints = 13;
  const normalized = gradePoints / totalMaxPoints;

  let overallGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  if (normalized >= 0.9) overallGrade = 'A';
  else if (normalized >= 0.75) overallGrade = 'B';
  else if (normalized >= 0.6) overallGrade = 'C';
  else if (normalized >= 0.4) overallGrade = 'D';
  else overallGrade = 'F';

  if (recommendations.length === 0) {
    recommendations.push('Seed passes all quality checks — no action needed');
  }

  return {
    seed: normalizedSeed,
    entropy,
    distribution,
    overallGrade,
    recommendations,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ML FEATURE EXTRACTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extracts a 24-dimensional ML feature vector from a seed's characteristics.
 *
 * Dimensions:
 * [0]  Shannon entropy (normalized)
 * [1]  Monobit balance
 * [2]  Avalanche score
 * [3]  Longest bit run (normalized)
 * [4]  Chi-squared pass (0/1)
 * [5]  Distribution bias (cards subsystem)
 * [6]  Distribution bias (battle subsystem)
 * [7]  Distribution bias (cascade subsystem)
 * [8-11]  Mode affinity scores (GO_ALONE, HEAD_TO_HEAD, TEAM_UP, CHASE_A_LEGEND)
 * [12-14] Phase sensitivity scores (FOUNDATION, ESCALATION, SOVEREIGNTY)
 * [15-18] Deck draw bias for first 4 legal deck types in GO_ALONE
 * [19]  Ghost marker alignment (GOLD_BUY derived)
 * [20]  Tag weighted score for LIQUIDITY+INCOME+SCALE in GO_ALONE
 * [21]  Rarity distribution skew
 * [22]  Deck profile heat average
 * [23]  Cord weight average across deck profiles
 */
export function extractSeedMLFeatures(seed: number): SeedMLFeatureVector {
  const normalizedSeed = normalizeSeed(seed);
  const entropyData = analyzeSeedEntropy(normalizedSeed);
  const features: number[] = [];
  const featureLabels: string[] = [];

  // [0] Shannon entropy normalized to [0,1] range (max 4 bits for 4 bytes)
  features.push(round6(entropyData.shannonEntropy / 4.0));
  featureLabels.push('entropy_normalized');

  // [1] Monobit balance
  features.push(entropyData.monobitBalance);
  featureLabels.push('monobit_balance');

  // [2] Avalanche score
  features.push(entropyData.avalancheScore);
  featureLabels.push('avalanche_score');

  // [3] Longest bit run normalized (32 max)
  features.push(round6(entropyData.longestRun / 32));
  featureLabels.push('longest_run_norm');

  // [4] Chi-squared pass
  features.push(entropyData.chiSquaredPassed ? 1.0 : 0.0);
  featureLabels.push('chi_squared_pass');

  // [5-7] Distribution bias for cards, battle, cascade subsystems
  const subsystemsForBias = ['cards', 'battle', 'cascade'];
  for (const subsystem of subsystemsForBias) {
    const subSeed = deriveSubsystemSeedInternal(normalizedSeed, subsystem);
    const bias = computeSeedDistributionBias(subSeed, 500, 20);
    features.push(bias);
    featureLabels.push(`dist_bias_${subsystem}`);
  }

  // [8-11] Mode affinity: use deriveSeedForMode and normalize
  const modeAffinity: Record<string, number> = {};
  for (const mode of ALL_GAME_MODES) {
    const modeSeed = deriveSeedForMode(normalizedSeed, mode);
    const affinity = round6(seedToFloat(modeSeed));
    modeAffinity[mode] = affinity;
    features.push(affinity);
    featureLabels.push(`mode_affinity_${mode}`);
  }

  // [12-14] Phase sensitivity
  const phaseAffinity: Record<string, number> = {};
  for (const phase of ALL_RUN_PHASES) {
    const phaseSeed = combineSeed(normalizedSeed, `phase_sense:${phase}`);
    const sensitivity = round6(seedToFloat(phaseSeed));
    phaseAffinity[phase] = sensitivity;
    features.push(sensitivity);
    featureLabels.push(`phase_sense_${phase}`);
  }

  // [15-18] Deck draw bias for first 4 legal deck types in GO_ALONE
  const goAloneDecks = CARD_LEGALITY_MATRIX[GameMode.GO_ALONE];
  const deckDrawBias: Record<string, number> = {};
  for (let i = 0; i < 4 && i < goAloneDecks.length; i++) {
    const deckType = goAloneDecks[i];
    const drawState = deriveSeedForDeckDraw(normalizedSeed, deckType, 0);
    const bias = round6(drawState.rarityRoll);
    deckDrawBias[deckType] = bias;
    features.push(bias);
    featureLabels.push(`deck_draw_bias_${deckType}`);
  }

  // [19] Ghost marker alignment (GOLD_BUY derived)
  const ghostSeed = combineSeed(normalizedSeed, `ghost:${GhostMarkerKind.GOLD_BUY}`);
  const ghostAlignment = round6(seedToFloat(ghostSeed));
  features.push(ghostAlignment);
  featureLabels.push('ghost_gold_buy_alignment');

  // [20] Tag weighted score for [LIQUIDITY, INCOME, SCALE] in GO_ALONE
  const selectedTags = [CardTag.LIQUIDITY, CardTag.INCOME, CardTag.SCALE];
  const tagScore = computeTagWeightedScore(selectedTags, GameMode.GO_ALONE);
  const normalizedTagScore = round6(tagScore / 10);
  features.push(clamp(normalizedTagScore, 0, 1));
  featureLabels.push('tag_score_liquidity_income_scale');

  // Tag weighted scores for all modes
  const tagWeightedScores: Record<string, number> = {};
  for (const mode of ALL_GAME_MODES) {
    const modeScore = computeTagWeightedScore(ALL_CARD_TAGS, mode);
    tagWeightedScores[mode] = round6(modeScore);
  }

  // [21] Rarity distribution skew: compute draws, check how far from expected
  const rarityWeights = buildRarityWeightArray();
  const sanitizedWeights = sanitizePositiveWeights(rarityWeights);
  const totalRarityWeight = sanitizedWeights.reduce((s, w) => s + w, 0);
  const rarityRng = createDeterministicRng(combineSeed(normalizedSeed, 'rarity_skew'));
  let rarityDeviation = 0;
  const rarityCounts = new Array<number>(ALL_CARD_RARITIES.length).fill(0);
  const raritySampleCount = 200;

  for (let i = 0; i < raritySampleCount; i++) {
    const idx = rarityRng.pickIndexByWeights(sanitizedWeights);
    rarityCounts[idx] += 1;
  }

  for (let i = 0; i < ALL_CARD_RARITIES.length; i++) {
    const expected = (sanitizedWeights[i] / totalRarityWeight) * raritySampleCount;
    rarityDeviation += Math.abs(rarityCounts[i] - expected);
  }
  const raritySkew = round6(rarityDeviation / (2 * raritySampleCount));
  features.push(clamp(raritySkew, 0, 1));
  featureLabels.push('rarity_distribution_skew');

  // [22] Average heat across all deck type profiles
  let heatSum = 0;
  for (const dt of ALL_DECK_TYPES) {
    const profile = getDeckTypeProfile(dt);
    heatSum += profile.baselineHeat;
  }
  const avgHeat = round6(heatSum / ALL_DECK_TYPES.length);
  features.push(clamp(avgHeat, 0, 1));
  featureLabels.push('deck_profile_heat_avg');

  // [23] Average cord weight across all deck type profiles
  let cordSum = 0;
  for (const dt of ALL_DECK_TYPES) {
    const profile = getDeckTypeProfile(dt);
    cordSum += profile.baselineCordWeight;
  }
  const avgCord = round6(cordSum / ALL_DECK_TYPES.length);
  features.push(clamp(avgCord / 2, 0, 1));
  featureLabels.push('deck_profile_cord_avg');

  return {
    seed: normalizedSeed,
    dimensions: ML_FEATURE_DIMENSIONS,
    features,
    featureLabels,
    modeAffinity,
    phaseAffinity,
    deckDrawBias,
    tagWeightedScores,
    entropyNormalized: features[0],
    bitBalanceNormalized: features[1],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DL TENSOR EXTRACTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extracts a 32x6 DL tensor from a seed's derivation paths across ticks.
 *
 * Rows (32): Each row represents a tick derivation path (tick 0..31).
 * Columns (6): Subsystem features per tick:
 *   [0] cards RNG value
 *   [1] battle RNG value
 *   [2] cascade RNG value
 *   [3] tension RNG value
 *   [4] pressure RNG value
 *   [5] shield RNG value
 *
 * Uses createMulberry32 for lightweight row generation to avoid
 * allocating full DeterministicRng instances per cell.
 */
export function extractSeedDLTensor(seed: number): SeedDLTensor {
  const normalizedSeed = normalizeSeed(seed);
  const subsystemNames = ['cards', 'battle', 'cascade', 'tension', 'pressure', 'shield'];
  const data: number[][] = [];
  const rowLabels: string[] = [];
  const colLabels = subsystemNames.map((s) => `${s}_rng_value`);

  const subsystemSeeds: number[] = subsystemNames.map((s) =>
    normalizeSeed(deriveSubsystemSeedInternal(normalizedSeed, s)),
  );

  for (let tick = 0; tick < DL_TENSOR_ROWS; tick++) {
    const row: number[] = [];
    const tickLabel = `tick_${seedToRange(combineSeed(normalizedSeed, `label:${tick}`), 0, 1000)}`;
    rowLabels.push(tickLabel);

    for (let col = 0; col < DL_TENSOR_COLS; col++) {
      const tickSeed = combineSeed(subsystemSeeds[col], `tensor_tick:${tick}`);
      const mulberry = createMulberry32(tickSeed);
      const value = round6(mulberry());
      row.push(value);
    }

    data.push(row);
  }

  const tensorPayload = data.map((row) => row.join(',')).join('|');
  const tensorHash = sha256Hex(tensorPayload);

  return {
    seed: normalizedSeed,
    rows: DL_TENSOR_ROWS,
    cols: DL_TENSOR_COLS,
    data,
    rowLabels,
    colLabels,
    tensorHash,
  };
}

/**
 * Extracts a sovereignty-focused DL tensor variant that includes
 * sovereignty subsystem data alongside standard subsystems.
 * Uses createMulberry32 for each cell to keep allocation lightweight.
 */
export function extractSovereigntyDLTensor(seed: number): SeedDLTensor {
  const normalizedSeed = normalizeSeed(seed);
  const subsystemNames = ['sovereignty', 'cards', 'ghost', 'timing', 'phase', 'mode'];
  const data: number[][] = [];
  const rowLabels: string[] = [];
  const colLabels = subsystemNames.map((s) => `${s}_sov_value`);

  const subsystemSeeds: number[] = subsystemNames.map((s) =>
    normalizeSeed(deriveSubsystemSeedInternal(normalizedSeed, s)),
  );

  for (let tick = 0; tick < DL_TENSOR_ROWS; tick++) {
    const row: number[] = [];
    rowLabels.push(`sov_tick_${tick}`);

    for (let col = 0; col < DL_TENSOR_COLS; col++) {
      const cellSeed = combineSeed(subsystemSeeds[col], `sov_tensor:${tick}:${col}`);
      const mulberry = createMulberry32(cellSeed);
      const value = round6(mulberry());
      row.push(value);
    }

    data.push(row);
  }

  const tensorPayload = data.map((row) => row.join(',')).join('|');
  const tensorHash = sha256Hex(`sov:${tensorPayload}`);

  return {
    seed: normalizedSeed,
    rows: DL_TENSOR_ROWS,
    cols: DL_TENSOR_COLS,
    data,
    rowLabels,
    colLabels,
    tensorHash,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GHOST SEED COMPARISON
// ─────────────────────────────────────────────────────────────────────────────

/**
 * For CHASE_A_LEGEND mode: compares a player's seed against a legend seed
 * to determine divergence and alignment across ghost markers.
 * Uses GhostMarkerKind to compute per-marker alignment scores.
 */
export function compareSeedToLegend(
  playerSeed: number,
  legendSeed: number,
): SeedGhostComparison {
  const normalizedPlayer = normalizeSeed(playerSeed);
  const normalizedLegend = normalizeSeed(legendSeed);

  const markerAlignments: Record<string, number> = {};
  let totalAlignment = 0;

  for (const marker of ALL_GHOST_MARKER_KINDS) {
    const playerMarkerSeed = combineSeed(normalizedPlayer, `ghost_marker:${marker}`);
    const legendMarkerSeed = combineSeed(normalizedLegend, `ghost_marker:${marker}`);

    const playerVal = seedToFloat(playerMarkerSeed);
    const legendVal = seedToFloat(legendMarkerSeed);

    const alignment = round6(1 - Math.abs(playerVal - legendVal));
    markerAlignments[marker] = alignment;
    totalAlignment += alignment;
  }

  const overallAlignment = round6(totalAlignment / ALL_GHOST_MARKER_KINDS.length);

  const phaseByPhaseDivergence: Record<string, number> = {};
  for (const phase of ALL_RUN_PHASES) {
    const playerPhaseSeed = combineSeed(normalizedPlayer, `ghost_phase:${phase}`);
    const legendPhaseSeed = combineSeed(normalizedLegend, `ghost_phase:${phase}`);
    const pDiv = round6(Math.abs(seedToFloat(playerPhaseSeed) - seedToFloat(legendPhaseSeed)));
    phaseByPhaseDivergence[phase] = pDiv;
  }

  const tagDivergence: Record<string, number> = {};
  const chaseWeights = MODE_TAG_WEIGHT_DEFAULTS[GameMode.CHASE_A_LEGEND];
  for (const tag of ALL_CARD_TAGS) {
    const tagWeight = chaseWeights[tag];
    if (tagWeight > 0) {
      const playerTagSeed = combineSeed(normalizedPlayer, `ghost_tag:${tag}`);
      const legendTagSeed = combineSeed(normalizedLegend, `ghost_tag:${tag}`);
      const tDiv = round6(Math.abs(seedToFloat(playerTagSeed) - seedToFloat(legendTagSeed)) * tagWeight);
      tagDivergence[tag] = tDiv;
    } else {
      tagDivergence[tag] = 0;
    }
  }

  const divergenceScore = round6(1 - overallAlignment);

  let recommendation: string;
  if (overallAlignment >= 0.8) {
    recommendation = 'High alignment — legend replay closely mirrors player decisions';
  } else if (overallAlignment >= 0.5) {
    recommendation = 'Moderate alignment — some divergent decision points expected';
  } else {
    recommendation = 'Low alignment — expect significantly different gameplay experience';
  }

  return {
    playerSeed: normalizedPlayer,
    legendSeed: normalizedLegend,
    divergenceScore,
    markerAlignments,
    overallAlignment,
    phaseByPhaseDivergence,
    tagDivergence,
    recommendation,
  };
}

/**
 * Computes a detailed divergence profile between two seeds for
 * CHASE_A_LEGEND mode, analyzing how the seeds differ across
 * each subsystem's derivation path.
 */
export function computeSeedDivergenceProfile(
  playerSeed: number,
  legendSeed: number,
  tickCount: number = 30,
): {
  readonly tickDivergences: readonly number[];
  readonly subsystemDivergences: Record<string, number>;
  readonly maxDivergenceTick: number;
  readonly averageDivergence: number;
} {
  const normalizedPlayer = normalizeSeed(playerSeed);
  const normalizedLegend = normalizeSeed(legendSeed);
  const subsystems = ['cards', 'battle', 'cascade', 'tension', 'pressure', 'shield'];

  const tickDivergences: number[] = [];
  const subsystemDivergenceSums: Record<string, number> = {};
  for (const s of subsystems) {
    subsystemDivergenceSums[s] = 0;
  }

  let maxDivergence = 0;
  let maxDivergenceTick = 0;

  for (let tick = 0; tick < tickCount; tick++) {
    let tickDivSum = 0;

    for (const subsystem of subsystems) {
      const playerTickSeed = deriveSeedForTick(normalizedPlayer, subsystem, tick);
      const legendTickSeed = deriveSeedForTick(normalizedLegend, subsystem, tick);

      const playerVal = seedToFloat(playerTickSeed);
      const legendVal = seedToFloat(legendTickSeed);
      const divergence = Math.abs(playerVal - legendVal);

      tickDivSum += divergence;
      subsystemDivergenceSums[subsystem] += divergence;
    }

    const avgTickDiv = round6(tickDivSum / subsystems.length);
    tickDivergences.push(avgTickDiv);

    if (avgTickDiv > maxDivergence) {
      maxDivergence = avgTickDiv;
      maxDivergenceTick = tick;
    }
  }

  const subsystemDivergences: Record<string, number> = {};
  for (const s of subsystems) {
    subsystemDivergences[s] = round6(subsystemDivergenceSums[s] / tickCount);
  }

  const averageDivergence = round6(
    tickDivergences.reduce((s, d) => s + d, 0) / tickCount,
  );

  return {
    tickDivergences,
    subsystemDivergences,
    maxDivergenceTick,
    averageDivergence,
  };
}

/**
 * Analyzes ghost seed alignment for the CHASE_A_LEGEND mode across
 * all ghost marker kinds and deck types legal in that mode.
 * Uses getDeckTypeProfile for deck-level alignment scoring.
 */
export function analyzeGhostSeedAlignment(
  playerSeed: number,
  legendSeed: number,
): {
  readonly markerAlignments: Record<string, number>;
  readonly deckAlignments: Record<string, number>;
  readonly overallScore: number;
  readonly ghostRecommendation: string;
} {
  const normalizedPlayer = normalizeSeed(playerSeed);
  const normalizedLegend = normalizeSeed(legendSeed);

  const markerAlignments: Record<string, number> = {};
  let markerTotal = 0;

  for (const marker of ALL_GHOST_MARKER_KINDS) {
    const pSeed = combineSeed(normalizedPlayer, `ghost_align:${marker}`);
    const lSeed = combineSeed(normalizedLegend, `ghost_align:${marker}`);
    const alignment = round6(1 - Math.abs(seedToFloat(pSeed) - seedToFloat(lSeed)));
    markerAlignments[marker] = alignment;
    markerTotal += alignment;
  }

  const ghostDecks = CARD_LEGALITY_MATRIX[GameMode.CHASE_A_LEGEND];
  const deckAlignments: Record<string, number> = {};
  let deckTotal = 0;

  for (const deckType of ghostDecks) {
    const profile = getDeckTypeProfile(deckType);
    const pDeckSeed = combineSeed(normalizedPlayer, `ghost_deck:${deckType}`);
    const lDeckSeed = combineSeed(normalizedLegend, `ghost_deck:${deckType}`);

    const baseAlignment = 1 - Math.abs(seedToFloat(pDeckSeed) - seedToFloat(lDeckSeed));
    const weightedAlignment = round6(baseAlignment * profile.drawRateMultiplier);
    deckAlignments[deckType] = weightedAlignment;
    deckTotal += weightedAlignment;
  }

  const markerAvg = markerTotal / ALL_GHOST_MARKER_KINDS.length;
  const deckAvg = ghostDecks.length > 0 ? deckTotal / ghostDecks.length : 0;
  const overallScore = round6((markerAvg + deckAvg) / 2);

  let ghostRecommendation: string;
  if (overallScore >= 0.75) {
    ghostRecommendation = 'Strong ghost alignment — player will closely track legend decisions';
  } else if (overallScore >= 0.45) {
    ghostRecommendation = 'Moderate ghost alignment — noticeable deviations at key decision points';
  } else {
    ghostRecommendation = 'Weak ghost alignment — player and legend paths will diverge significantly';
  }

  return {
    markerAlignments,
    deckAlignments,
    overallScore,
    ghostRecommendation,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MODE-AWARE SEED PROFILES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds a comprehensive seed profile for a specific GameMode.
 * Uses CARD_LEGALITY_MATRIX, getModeCardBehavior, HOLD_SYSTEM_CONFIG,
 * and COMEBACK_SURGE_CONFIG to compute mode-specific seed characteristics.
 */
export function buildSeedModeProfile(
  masterSeed: number,
  mode: GameMode,
): SeedModeProfile {
  const normalizedSeed = normalizeSeed(masterSeed);
  const modeBehavior = getModeCardBehavior(mode);
  const legalDeckTypes = CARD_LEGALITY_MATRIX[mode];

  const deckDrawWeights = computeDeckDrawWeightsForMode(mode, normalizedSeed);
  const tagInfluenceScores = computeTagInfluenceForMode(mode);

  const holdBasePerRun = HOLD_SYSTEM_CONFIG.baseHoldsPerRun;
  const holdMomentumThreshold = HOLD_SYSTEM_CONFIG.momentumThreshold;
  const holdRng = createDeterministicRng(combineSeed(normalizedSeed, `hold:${mode}`));
  const holdRoll = holdRng.next();
  const holdSystemAdjustment = round6(
    modeBehavior.holdEnabled
      ? holdBasePerRun + (holdRoll > (holdMomentumThreshold / 10) ? HOLD_SYSTEM_CONFIG.bonusHoldsOnThreshold : 0)
      : 0,
  );

  const comebackSurgeThreshold = round6(COMEBACK_SURGE_CONFIG.cashThresholdPct);
  const comebackEmergencyCash = COMEBACK_SURGE_CONFIG.emergencyCash;
  const comebackHeatFreeze = COMEBACK_SURGE_CONFIG.heatFreezeTicks;

  const comebackRng = createDeterministicRng(combineSeed(normalizedSeed, `comeback:${mode}`));
  const comebackAdjust = round6(
    comebackSurgeThreshold * (1 + comebackRng.next() * 0.1)
      + (comebackEmergencyCash * 0.0001)
      + (comebackHeatFreeze * 0.0001),
  );

  const seedDerivedPhaseBias = computePhaseBias(
    combineSeed(normalizedSeed, `mode_phase:${mode}`),
  );

  const pressureTierSeedOffsets = computePressureTierOffsets(
    combineSeed(normalizedSeed, `mode_pressure:${mode}`),
  );

  const phaseGatingRng = createDeterministicRng(
    combineSeed(normalizedSeed, `phase_gating:${mode}`),
  );
  const phaseGatingSensitivity = round6(
    modeBehavior.phaseGatingEnabled ? phaseGatingRng.next() : 0,
  );

  return {
    mode,
    masterSeed: normalizedSeed,
    legalDeckTypes: [...legalDeckTypes],
    deckDrawWeights,
    tagInfluenceScores,
    holdSystemAdjustment,
    comebackSurgeThreshold: comebackAdjust,
    battleBudgetEnabled: modeBehavior.battleBudgetEnabled,
    trustEnabled: modeBehavior.trustEnabled,
    ghostEnabled: modeBehavior.ghostEnabled,
    rescueEnabled: modeBehavior.rescueEnabled,
    counterWindowEnabled: modeBehavior.counterWindowEnabled,
    aidWindowEnabled: modeBehavior.aidWindowEnabled,
    phaseGatingSensitivity,
    defaultChannel: modeBehavior.defaultChannel,
    stageMood: modeBehavior.stageMood,
    seedDerivedPhaseBias,
    pressureTierSeedOffsets,
  };
}

/**
 * Builds seed mode profiles for all four game modes.
 */
export function buildAllSeedModeProfiles(
  masterSeed: number,
): Record<string, SeedModeProfile> {
  const result: Record<string, SeedModeProfile> = {};
  for (const mode of ALL_GAME_MODES) {
    result[mode] = buildSeedModeProfile(masterSeed, mode);
  }
  return result;
}

/**
 * Computes a mode compatibility score: how well a seed's RNG stream
 * aligns with the preferred tag distribution of each mode.
 * Uses MODE_TAG_WEIGHT_DEFAULTS and computeTagWeightedScore.
 */
export function computeSeedModeCompatibility(
  seed: number,
): Record<string, number> {
  const normalizedSeed = normalizeSeed(seed);
  const result: Record<string, number> = {};

  for (const mode of ALL_GAME_MODES) {
    const modeSeed = deriveSeedForMode(normalizedSeed, mode);
    const rng = createDeterministicRng(modeSeed);

    const tagSample: CardTag[] = [];
    for (let i = 0; i < 20; i++) {
      const tagIndex = rng.nextInt(ALL_CARD_TAGS.length);
      tagSample.push(ALL_CARD_TAGS[tagIndex]);
    }

    const score = computeTagWeightedScore(tagSample, mode);
    const modeWeights = MODE_TAG_WEIGHT_DEFAULTS[mode];
    let maxPossible = 0;
    for (const tag of ALL_CARD_TAGS) {
      maxPossible += modeWeights[tag];
    }

    result[mode] = round6(maxPossible > 0 ? clamp(score / maxPossible, 0, 1) : 0);
  }

  return result;
}

/**
 * Analyzes how a seed's deck draw distribution matches the
 * expected rarity drop rates for each mode's legal deck types.
 */
export function analyzeSeedDeckDrawDistribution(
  seed: number,
  mode: GameMode,
  drawCount: number = 100,
): {
  readonly deckDistribution: Record<string, number>;
  readonly rarityDistribution: Record<string, number>;
  readonly expectedVsActual: Record<string, { expected: number; actual: number }>;
} {
  const normalizedSeed = normalizeSeed(seed);
  const legalDecks = CARD_LEGALITY_MATRIX[mode];
  const deckCounts: Record<string, number> = {};
  const rarityCounts: Record<string, number> = {};

  for (const d of legalDecks) deckCounts[d] = 0;
  for (const r of ALL_CARD_RARITIES) rarityCounts[r] = 0;

  const weights: number[] = [];
  for (const deckType of legalDecks) {
    const profile = getDeckTypeProfile(deckType);
    weights.push(profile.drawRateMultiplier);
  }
  const sanitized = sanitizePositiveWeights(weights);

  const drawRng = createDeterministicRng(combineSeed(normalizedSeed, `draw_analysis:${mode}`));

  for (let i = 0; i < drawCount; i++) {
    const deckIdx = drawRng.pickIndexByWeights(sanitized);
    const selectedDeck = legalDecks[deckIdx];
    deckCounts[selectedDeck] = (deckCounts[selectedDeck] || 0) + 1;

    const rarityRoll = drawRng.next();
    const rarity = selectRarityFromRoll(rarityRoll);
    rarityCounts[rarity] = (rarityCounts[rarity] || 0) + 1;
  }

  const deckDistribution: Record<string, number> = {};
  for (const d of legalDecks) {
    deckDistribution[d] = round6(deckCounts[d] / drawCount);
  }

  const rarityDistribution: Record<string, number> = {};
  for (const r of ALL_CARD_RARITIES) {
    rarityDistribution[r] = round6(rarityCounts[r] / drawCount);
  }

  const expectedVsActual: Record<string, { expected: number; actual: number }> = {};
  for (const r of ALL_CARD_RARITIES) {
    expectedVsActual[r] = {
      expected: CARD_RARITY_DROP_RATES[r],
      actual: rarityDistribution[r],
    };
  }

  return { deckDistribution, rarityDistribution, expectedVsActual };
}

// ─────────────────────────────────────────────────────────────────────────────
// CHAT BRIDGE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates chat bridge events for run lifecycle integration.
 * Produces events when seeds are committed, verified, or found anomalous.
 * These events can be forwarded to the chat/notification subsystem.
 */
export function generateSeedChatBridgeEvents(
  material: SeedMaterial,
  context: {
    readonly isVerification?: boolean;
    readonly isAnomaly?: boolean;
    readonly anomalyReason?: string;
    readonly poolAdvanced?: boolean;
    readonly chainExtended?: boolean;
    readonly currentTick?: number;
  } = {},
): readonly SeedChatBridgeEvent[] {
  const events: SeedChatBridgeEvent[] = [];
  const commitment = generateSeedCommitment(material);
  const now = Date.now();

  events.push({
    eventType: 'SEED_COMMITTED',
    timestamp: now,
    seed: commitment.seed,
    payload: {
      seedHex: commitment.seedHex,
      commitment: commitment.commitment,
      canonicalMaterial: commitment.canonicalMaterial,
      runId: material.runId,
      namespace: material.namespace ?? 'pzo',
      mode: material.mode ?? 'default',
    },
    humanReadable: `Seed ${commitment.seedHex} committed for run ${String(material.runId)}`,
  });

  if (context.isVerification) {
    const verificationResult = verifySeedAgainstReplay(material, []);
    events.push({
      eventType: 'SEED_VERIFIED',
      timestamp: now + 1,
      seed: commitment.seed,
      payload: {
        valid: verificationResult.valid,
        proofHash: verificationResult.proofHash,
        details: verificationResult.details,
      },
      humanReadable: verificationResult.valid
        ? `Seed ${commitment.seedHex} verified successfully`
        : `Seed ${commitment.seedHex} verification FAILED: ${verificationResult.details}`,
    });
  }

  if (context.isAnomaly) {
    const entropy = analyzeSeedEntropy(commitment.seed);
    events.push({
      eventType: 'SEED_ANOMALY',
      timestamp: now + 2,
      seed: commitment.seed,
      payload: {
        reason: context.anomalyReason ?? 'Unknown anomaly',
        entropyGrade: entropy.entropyGrade,
        shannonEntropy: entropy.shannonEntropy,
        monobitBalance: entropy.monobitBalance,
      },
      humanReadable: `ANOMALY detected for seed ${commitment.seedHex}: ${context.anomalyReason ?? 'Unknown'}`,
    });
  }

  if (context.poolAdvanced) {
    events.push({
      eventType: 'SEED_POOL_ADVANCED',
      timestamp: now + 3,
      seed: commitment.seed,
      payload: {
        tick: context.currentTick ?? 0,
        runId: material.runId,
      },
      humanReadable: `Seed pool advanced to tick ${context.currentTick ?? 0} for run ${String(material.runId)}`,
    });
  }

  if (context.chainExtended) {
    events.push({
      eventType: 'SEED_CHAIN_EXTENDED',
      timestamp: now + 4,
      seed: commitment.seed,
      payload: {
        runId: material.runId,
        tick: context.currentTick ?? 0,
      },
      humanReadable: `Seed chain extended at tick ${context.currentTick ?? 0} for run ${String(material.runId)}`,
    });
  }

  return events;
}

// ─────────────────────────────────────────────────────────────────────────────
// BATCH PROCESSING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates a batch of seed commitments from an array of run IDs.
 * Each commitment is derived independently, and the batch is hashed
 * together to produce a batch integrity hash.
 */
export function generateSeedBatch(
  runIds: readonly (string | number)[],
  baseNamespace: string = 'pzo',
  mode: string = 'default',
): SeedBatchResult {
  const seeds: SeedCommitment[] = [];
  const entropyValues: number[] = [];
  let failedCount = 0;

  for (const runId of runIds) {
    const material: SeedMaterial = {
      runId,
      namespace: baseNamespace,
      mode,
    };
    const commitment = generateSeedCommitment(material);
    seeds.push(commitment);

    const entropy = computeSeedEntropy(commitment.seed);
    entropyValues.push(entropy);

    if (entropy < MIN_ACCEPTABLE_ENTROPY) {
      failedCount++;
    }
  }

  const batchPayload = seeds.map((s) => s.commitment).join(':');
  const batchHash = sha256Hex(batchPayload);
  const batchId = sha256Hex(`batch:${batchHash}:${Date.now()}`).slice(0, 16);

  const meanEntropy = entropyValues.length > 0
    ? round6(entropyValues.reduce((s, e) => s + e, 0) / entropyValues.length)
    : 0;
  const minEntropy = entropyValues.length > 0
    ? round6(Math.min(...entropyValues))
    : 0;
  const maxEntropy = entropyValues.length > 0
    ? round6(Math.max(...entropyValues))
    : 0;

  return {
    batchId,
    seeds,
    batchHash,
    entropyReport: {
      meanEntropy,
      minEntropy,
      maxEntropy,
      failedCount,
    },
    generatedAt: Date.now(),
  };
}

/**
 * Validates a batch of seed commitments by re-deriving each seed
 * and checking that the commitment hashes match.
 */
export function validateSeedBatch(batch: SeedBatchResult): {
  readonly valid: boolean;
  readonly invalidIndices: readonly number[];
  readonly recomputedBatchHash: string;
} {
  const invalidIndices: number[] = [];

  for (let i = 0; i < batch.seeds.length; i++) {
    const seed = batch.seeds[i];
    const recomputedHex = seed.seed.toString(16).padStart(8, '0');

    const expectedCommitment = createHash('sha256')
      .update(`${seed.canonicalMaterial}|seedHex=${recomputedHex}`, 'utf8')
      .digest('hex');

    if (expectedCommitment !== seed.commitment) {
      invalidIndices.push(i);
    }
  }

  const recomputedBatchPayload = batch.seeds.map((s) => s.commitment).join(':');
  const recomputedBatchHash = sha256Hex(recomputedBatchPayload);

  return {
    valid: invalidIndices.length === 0 && recomputedBatchHash === batch.batchHash,
    invalidIndices,
    recomputedBatchHash,
  };
}

/**
 * Computes a comprehensive entropy report for a batch of seeds.
 */
export function computeBatchEntropyReport(
  batch: SeedBatchResult,
): {
  readonly totalSeeds: number;
  readonly entropyAnalyses: readonly SeedEntropyAnalysis[];
  readonly gradeDistribution: Record<string, number>;
  readonly overallHealth: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
} {
  const entropyAnalyses: SeedEntropyAnalysis[] = [];
  const gradeDistribution: Record<string, number> = {
    EXCELLENT: 0,
    GOOD: 0,
    ACCEPTABLE: 0,
    POOR: 0,
  };

  for (const seedCommitment of batch.seeds) {
    const analysis = analyzeSeedEntropy(seedCommitment.seed);
    entropyAnalyses.push(analysis);
    gradeDistribution[analysis.entropyGrade] += 1;
  }

  const totalSeeds = batch.seeds.length;
  const poorCount = gradeDistribution['POOR'];
  const acceptableCount = gradeDistribution['ACCEPTABLE'];

  let overallHealth: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
  if (poorCount === 0 && acceptableCount <= totalSeeds * 0.1) {
    overallHealth = 'HEALTHY';
  } else if (poorCount <= totalSeeds * 0.1) {
    overallHealth = 'DEGRADED';
  } else {
    overallHealth = 'CRITICAL';
  }

  return {
    totalSeeds,
    entropyAnalyses,
    gradeDistribution,
    overallHealth,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// IMPORT / EXPORT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Exports a complete seed run profile as a JSON-transportable object.
 * Includes master seed, mode profile, phase derivations, subsystem
 * derivations, entropy analysis, commitment, and pool state.
 */
export function exportSeedProfile(
  runId: string,
  masterSeed: number,
  mode: GameMode,
): SeedRunProfile {
  const normalizedSeed = normalizeSeed(masterSeed);

  const material: SeedMaterial = {
    runId,
    namespace: 'pzo',
    mode,
  };
  const commitment = generateSeedCommitment(material);

  const modeProfile = buildSeedModeProfile(normalizedSeed, mode);

  const phaseDerivations = ALL_RUN_PHASES.map((phase) =>
    deriveSeedForPhase(normalizedSeed, phase, PressureTier.T1_STABLE),
  );

  const subsystemDerivations = deriveAllSubsystemSeeds(normalizedSeed);
  const entropyAnalysis = analyzeSeedEntropy(normalizedSeed);

  const subsystemNames = Object.keys(SUBSYSTEM_NAMESPACE_REGISTRY);
  const poolState = createSeedPool({
    masterSeed: normalizedSeed,
    subsystems: subsystemNames,
    tickCapacity: 256,
    precomputeDepth: 0,
  });

  return {
    runId,
    masterSeed: normalizedSeed,
    mode,
    modeProfile,
    phaseDerivations,
    subsystemDerivations,
    entropyAnalysis,
    commitment,
    poolState,
    version: SEED_GENERATOR_VERSION,
    exportedAt: Date.now(),
  };
}

/**
 * Imports and validates a seed run profile from a JSON-transportable object.
 * Verifies that the commitment matches, seeds are consistent, and the
 * pool integrity hash is valid.
 */
export function importSeedProfile(
  profile: SeedRunProfile,
): {
  readonly valid: boolean;
  readonly seedConsistent: boolean;
  readonly commitmentValid: boolean;
  readonly poolIntegrityValid: boolean;
  readonly entropyGrade: string;
  readonly details: string;
} {
  const recomputedMaterial: SeedMaterial = {
    runId: profile.runId,
    namespace: 'pzo',
    mode: profile.mode,
  };
  const recomputedCommitment = generateSeedCommitment(recomputedMaterial);

  const seedConsistent = recomputedCommitment.seed === profile.masterSeed
    || normalizeSeed(profile.masterSeed) === normalizeSeed(recomputedCommitment.seed)
    || profile.commitment.seed === recomputedCommitment.seed;

  const commitmentValid = profile.commitment.commitment === recomputedCommitment.commitment;

  const recomputedPoolHash = computePoolIntegrityHash(profile.poolState.subsystemStates);
  const poolIntegrityValid = recomputedPoolHash === profile.poolState.poolIntegrityHash;

  const entropyGrade = profile.entropyAnalysis.entropyGrade;

  const valid = commitmentValid && poolIntegrityValid;
  const details = valid
    ? `Profile for run ${profile.runId} imported successfully (entropy: ${entropyGrade})`
    : `Profile for run ${profile.runId} has integrity issues: commitment=${commitmentValid}, pool=${poolIntegrityValid}`;

  return {
    valid,
    seedConsistent,
    commitmentValid,
    poolIntegrityValid,
    entropyGrade,
    details,
  };
}

/**
 * Serializes a SeedRunProfile to a stable JSON string suitable for
 * transport or storage. Uses stableStringify to ensure deterministic
 * key ordering.
 */
export function serializeSeedProfile(profile: SeedRunProfile): string {
  return stableStringify(profile);
}

/**
 * Computes a verification hash for a serialized seed profile.
 * This hash can be transmitted alongside the profile to verify integrity
 * on the receiving end.
 */
export function computeSeedProfileHash(profile: SeedRunProfile): string {
  const serialized = serializeSeedProfile(profile);
  return sha256Hex(serialized);
}

// ─────────────────────────────────────────────────────────────────────────────
// ADVANCED SEED DERIVATION UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Derives a seed tailored to a specific card rarity tier.
 * Higher rarities get additional entropy mixing to ensure legendary
 * cards are genuinely rare and not predictable from common card seeds.
 */
export function deriveSeedForRarity(
  masterSeed: number,
  rarity: CardRarity,
  drawIndex: number,
): number {
  const dropRate = CARD_RARITY_DROP_RATES[rarity];
  const rarityOrdinal = ALL_CARD_RARITIES.indexOf(rarity);
  const baseSalt = `rarity:${rarity}:draw:${drawIndex}:rate:${dropRate}`;
  const derived = combineSeed(masterSeed, baseSalt);

  if (rarityOrdinal >= 2) {
    const extraMix = combineSeed(derived, `extra_entropy:${rarityOrdinal}`);
    return normalizeSeed(extraMix);
  }

  return normalizeSeed(derived);
}

/**
 * Derives seeds for the comeback surge system.
 * Uses COMEBACK_SURGE_CONFIG parameters to determine when and how
 * the comeback surge activates based on the seed's RNG stream.
 */
export function deriveComebackSurgeSeed(
  masterSeed: number,
  currentCashPct: number,
  mode: GameMode,
): {
  readonly surgeActivated: boolean;
  readonly emergencyCash: number;
  readonly heatFreezeTicks: number;
  readonly surgeSeed: number;
  readonly shieldBoost: number;
} {
  const threshold = COMEBACK_SURGE_CONFIG.cashThresholdPct;
  const surgeSalt = `comeback_surge:${mode}:cash_pct:${round6(currentCashPct)}`;
  const surgeSeed = combineSeed(masterSeed, surgeSalt);
  const normalizedSurgeSeed = normalizeSeed(surgeSeed);

  const surgeRng = createDeterministicRng(normalizedSurgeSeed);
  const surgeRoll = surgeRng.next();

  const surgeActivated = currentCashPct <= threshold;

  const speedWeight = COMEBACK_SURGE_CONFIG.decisionSpeedWeight;
  const adjustedEmergencyCash = round6(
    COMEBACK_SURGE_CONFIG.emergencyCash * (1 + surgeRoll * speedWeight),
  );

  const shieldBoost = round6(
    COMEBACK_SURGE_CONFIG.shieldBoostAll * (surgeActivated ? 1 : 0),
  );

  return {
    surgeActivated,
    emergencyCash: surgeActivated ? adjustedEmergencyCash : 0,
    heatFreezeTicks: surgeActivated ? COMEBACK_SURGE_CONFIG.heatFreezeTicks : 0,
    surgeSeed: normalizedSurgeSeed,
    shieldBoost,
  };
}

/**
 * Derives a seed for a specific decision effect, ensuring each effect
 * application has its own reproducible random stream.
 */
export function deriveSeedForDecisionEffect(
  masterSeed: number,
  effect: DecisionEffect,
  turnIndex: number,
): number {
  const effectSalt = `decision:${effect.target}:delta:${effect.delta}:turn:${turnIndex}`;
  return normalizeSeed(combineSeed(masterSeed, effectSalt));
}

/**
 * Creates a default ledger and derives seeds for each ledger field,
 * producing a mapping of field names to their dedicated seed streams.
 */
export function deriveLedgerFieldSeeds(
  masterSeed: number,
): Record<keyof Ledger, number> {
  const ledger = createDefaultLedger();
  const result: Record<string, number> = {};

  const fields: (keyof Ledger)[] = [
    'cash', 'income', 'expenses', 'shield',
    'heat', 'trust', 'divergence', 'cords', 'turn',
  ];

  for (const field of fields) {
    const fieldSeed = combineSeed(masterSeed, `ledger_field:${field}:base:${ledger[field]}`);
    result[field] = normalizeSeed(fieldSeed);
  }

  return result as Record<keyof Ledger, number>;
}

/**
 * Simulates a simplified run using a GameState and event log to validate
 * that seed-derived randomness produces consistent ledger outcomes.
 * Returns the final snapshot and a hash of the run.
 */
export function simulateSeedValidationRun(
  masterSeed: number,
  runId: string,
  turnCount: number,
): {
  readonly snapshot: ReplaySnapshot;
  readonly runHash: string;
  readonly turnSeeds: readonly number[];
} {
  const normalizedSeed = normalizeSeed(masterSeed);
  const initialLedger = createDefaultLedger({ cash: 1000, income: 100 });

  const events: RunEvent[] = [];
  const turnSeeds: number[] = [];

  const createEvent: RunEvent = {
    type: 'RUN_CREATED',
    runId,
    seed: normalizedSeed,
    createdAt: Date.now(),
    ledger: initialLedger,
  };
  events.push(createEvent);

  const rng = createDeterministicRng(normalizedSeed);

  for (let turn = 0; turn < turnCount; turn++) {
    const turnSeed = combineSeed(normalizedSeed, `sim_turn:${turn}`);
    turnSeeds.push(normalizeSeed(turnSeed));

    const cashDelta = round6((rng.next() - 0.5) * 200);
    const heatDelta = round6(rng.next() * 10);

    const effects: DecisionEffect[] = [
      { target: 'cash', delta: cashDelta },
      { target: 'heat', delta: heatDelta },
    ];

    const turnEvent: RunEvent = {
      type: 'TURN_SUBMITTED',
      runId,
      turnIndex: turn,
      decisionId: `decision_${turn}`,
      choiceId: `choice_${turn}`,
      submittedAt: Date.now() + turn,
      effects,
    };
    events.push(turnEvent);
  }

  const finalizeEvent: RunEvent = {
    type: 'RUN_FINALIZED',
    runId,
    finalizedAt: Date.now() + turnCount + 1,
  };
  events.push(finalizeEvent);

  const engine = new ReplayEngine(normalizedSeed, events);
  const snapshot = engine.replayAll();
  const runHash = engine.getReplayHash();

  return { snapshot, runHash, turnSeeds };
}

/**
 * Derives timing-window-specific seeds for each timing class.
 * Each timing class gets its own seed derived from the master seed
 * and the timing class identifier.
 */
export function deriveTimingWindowSeeds(
  masterSeed: number,
): Record<string, number> {
  const result: Record<string, number> = {};

  for (const tc of ALL_TIMING_CLASSES) {
    const timingSeed = combineSeed(masterSeed, `timing_window:${tc}`);
    result[tc] = normalizeSeed(timingSeed);
  }

  return result;
}

/**
 * Computes a multi-seed cross-correlation matrix for a set of seeds.
 * Useful for detecting unintentional correlations across runs.
 */
export function computeSeedCorrelationMatrix(
  seeds: readonly number[],
  sampleCount: number = 500,
): {
  readonly matrix: readonly (readonly number[])[];
  readonly seedCount: number;
  readonly highCorrelationPairs: readonly [number, number][];
} {
  const n = seeds.length;
  const matrix: number[][] = [];
  const highCorrelationPairs: [number, number][] = [];

  for (let i = 0; i < n; i++) {
    const row: number[] = [];
    for (let j = 0; j < n; j++) {
      if (i === j) {
        row.push(1.0);
      } else if (j < i) {
        row.push(matrix[j][i]);
      } else {
        const correlation = computeSeedCorrelation(seeds[i], seeds[j], sampleCount);
        row.push(correlation.pearsonR);
        if (correlation.isCorrelated) {
          highCorrelationPairs.push([i, j]);
        }
      }
    }
    matrix.push(row);
  }

  return { matrix, seedCount: n, highCorrelationPairs };
}

/**
 * Generates a seed using DEFAULT_NON_ZERO_SEED as a fallback when
 * the provided seed is invalid (zero, NaN, or Infinity).
 */
export function generateFallbackSeed(inputSeed: number): number {
  if (!Number.isFinite(inputSeed) || inputSeed === 0) {
    return DEFAULT_NON_ZERO_SEED;
  }
  return normalizeSeed(inputSeed);
}

/**
 * Computes mode-aware deck draw weights incorporating both the deck type
 * profile and the mode's tag weight defaults. For each legal deck type
 * in the mode, combines baselineCordWeight, drawRateMultiplier, and
 * the sum of relevant tag weights.
 */
export function computeModeAwareDeckWeights(
  mode: GameMode,
): Record<string, number> {
  const legalDecks = CARD_LEGALITY_MATRIX[mode];
  const modeWeights = MODE_TAG_WEIGHT_DEFAULTS[mode];
  const result: Record<string, number> = {};

  for (const deckType of legalDecks) {
    const profile = getDeckTypeProfile(deckType);
    const baseWeight = profile.baselineCordWeight * profile.drawRateMultiplier;

    let tagBonus = 0;
    for (const tag of ALL_CARD_TAGS) {
      tagBonus += modeWeights[tag] * 0.01;
    }

    result[deckType] = round6(baseWeight * (1 + tagBonus));
  }

  const rawWeights = Object.values(result);
  const sanitized = sanitizePositiveWeights(rawWeights);
  const totalWeight = sanitized.reduce((s, w) => s + w, 0);

  const keys = Object.keys(result);
  for (let i = 0; i < keys.length; i++) {
    result[keys[i]] = totalWeight > 0 ? round6(sanitized[i] / totalWeight) : 0;
  }

  return result;
}

/**
 * Creates a GhostMarkerKind-keyed seed map for CHASE_A_LEGEND mode,
 * where each marker type gets its own deterministic seed stream.
 */
export function deriveGhostMarkerSeeds(
  masterSeed: number,
): Record<string, number> {
  const normalizedSeed = normalizeSeed(masterSeed);
  const result: Record<string, number> = {};

  for (const marker of ALL_GHOST_MARKER_KINDS) {
    const markerSeed = combineSeed(normalizedSeed, `ghost_marker_derive:${marker}`);
    result[marker] = normalizeSeed(markerSeed);
  }

  return result;
}

/**
 * Derives a seed influenced by HOLD_SYSTEM_CONFIG parameters.
 * The hold system seed controls whether hold bonuses are granted
 * and how they interact with the cord multiplier.
 */
export function deriveHoldSystemSeed(
  masterSeed: number,
  currentMomentum: number,
): {
  readonly holdSeed: number;
  readonly bonusHoldsGranted: boolean;
  readonly cordMultiplier: number;
  readonly effectiveHoldsPerRun: number;
} {
  const holdSeed = combineSeed(masterSeed, 'hold_system');
  const normalizedHoldSeed = normalizeSeed(holdSeed);

  const rng = createDeterministicRng(normalizedHoldSeed);
  const holdRoll = rng.next();

  const momentumThreshold = HOLD_SYSTEM_CONFIG.momentumThreshold;
  const bonusHoldsGranted = currentMomentum >= momentumThreshold && holdRoll > 0.3;

  const baseHolds = HOLD_SYSTEM_CONFIG.baseHoldsPerRun;
  const bonusHolds = bonusHoldsGranted ? HOLD_SYSTEM_CONFIG.bonusHoldsOnThreshold : 0;
  const effectiveHoldsPerRun = baseHolds + bonusHolds;

  const cordMultiplier = bonusHoldsGranted
    ? 1.0
    : HOLD_SYSTEM_CONFIG.noHoldCordMultiplier;

  return {
    holdSeed: normalizedHoldSeed,
    bonusHoldsGranted,
    cordMultiplier: round6(cordMultiplier),
    effectiveHoldsPerRun,
  };
}

/**
 * Comprehensive seed derivation that produces seeds for every
 * pressure tier at every phase, creating a full pressure-phase matrix.
 */
export function derivePressurePhaseMatrix(
  masterSeed: number,
): Record<string, Record<string, number>> {
  const normalizedSeed = normalizeSeed(masterSeed);
  const result: Record<string, Record<string, number>> = {};

  for (const phase of ALL_RUN_PHASES) {
    result[phase] = {};
    for (const tier of ALL_PRESSURE_TIERS) {
      const matrixSeed = combineSeed(
        normalizedSeed,
        `pressure_phase_matrix:${phase}:${tier}`,
      );
      result[phase][tier] = normalizeSeed(matrixSeed);
    }
  }

  return result;
}

/**
 * Derives a DeckType-to-CardTag affinity matrix for a given seed and mode.
 * Each cell represents how strongly a particular deck type aligns with
 * a particular card tag under the seed's influence.
 */
export function deriveDeckTagAffinityMatrix(
  masterSeed: number,
  mode: GameMode,
): Record<string, Record<string, number>> {
  const normalizedSeed = normalizeSeed(masterSeed);
  const legalDecks = CARD_LEGALITY_MATRIX[mode];
  const modeWeights = MODE_TAG_WEIGHT_DEFAULTS[mode];
  const result: Record<string, Record<string, number>> = {};

  for (const deckType of legalDecks) {
    result[deckType] = {};
    const profile = getDeckTypeProfile(deckType);

    for (const tag of ALL_CARD_TAGS) {
      const cellSeed = combineSeed(normalizedSeed, `deck_tag:${deckType}:${tag}`);
      const rng = createMulberry32(cellSeed);
      const baseAffinity = rng();
      const tagWeight = modeWeights[tag];
      const cordInfluence = profile.baselineCordWeight;

      const affinity = round6(baseAffinity * tagWeight * cordInfluence);
      result[deckType][tag] = clamp(affinity, 0, 10);
    }
  }

  return result;
}

/**
 * Verifies the internal consistency of a complete SeedRunProfile
 * by re-deriving key components and checking for drift.
 */
export function verifySeedRunProfileConsistency(
  profile: SeedRunProfile,
): {
  readonly consistent: boolean;
  readonly phaseConsistent: boolean;
  readonly subsystemConsistent: boolean;
  readonly poolConsistent: boolean;
  readonly driftDetails: readonly string[];
} {
  const driftDetails: string[] = [];
  let phaseConsistent = true;
  let subsystemConsistent = true;

  for (const phaseDeriv of profile.phaseDerivations) {
    const recomputed = deriveSeedForPhase(
      profile.masterSeed,
      phaseDeriv.phase,
      PressureTier.T1_STABLE,
    );
    if (recomputed.phaseSeed !== phaseDeriv.phaseSeed) {
      phaseConsistent = false;
      driftDetails.push(`Phase ${phaseDeriv.phase} seed drift: expected ${recomputed.phaseSeed}, got ${phaseDeriv.phaseSeed}`);
    }
  }

  for (const subDeriv of profile.subsystemDerivations) {
    const recomputed = deriveSeedForSubsystem(profile.masterSeed, subDeriv.subsystem);
    if (recomputed.derivedSeed !== subDeriv.derivedSeed) {
      subsystemConsistent = false;
      driftDetails.push(`Subsystem ${subDeriv.subsystem} seed drift: expected ${recomputed.derivedSeed}, got ${subDeriv.derivedSeed}`);
    }
  }

  const recomputedPoolHash = computePoolIntegrityHash(profile.poolState.subsystemStates);
  const poolConsistent = recomputedPoolHash === profile.poolState.poolIntegrityHash;
  if (!poolConsistent) {
    driftDetails.push('Pool integrity hash mismatch');
  }

  const consistent = phaseConsistent && subsystemConsistent && poolConsistent;
  if (driftDetails.length === 0) {
    driftDetails.push('All consistency checks passed');
  }

  return {
    consistent,
    phaseConsistent,
    subsystemConsistent,
    poolConsistent,
    driftDetails,
  };
}

/**
 * Generates a cryptographic anchor for a seed that can be published
 * before a run begins, proving the seed was chosen before gameplay.
 * Uses sha256Hex from replay_engine for consistent hashing.
 */
export function generatePreRunSeedAnchor(
  material: SeedMaterial,
  timestamp: number,
): {
  readonly anchorHash: string;
  readonly commitment: SeedCommitment;
  readonly anchoredAt: number;
  readonly verificationPayload: string;
} {
  const commitment = generateSeedCommitment(material);

  const verificationPayload = stableStringify({
    seed: commitment.seed,
    commitment: commitment.commitment,
    material: commitment.canonicalMaterial,
    timestamp,
    version: SEED_GENERATOR_VERSION,
  });

  const anchorHash = sha256Hex(verificationPayload);

  return {
    anchorHash,
    commitment,
    anchoredAt: timestamp,
    verificationPayload,
  };
}

/**
 * Determines whether a given seed should use the fallback pathway.
 * Seeds that fail normalization stability or have zero entropy
 * should fall back to DEFAULT_NON_ZERO_SEED.
 */
export function shouldUseFallbackSeed(seed: number): boolean {
  if (!Number.isFinite(seed) || seed === 0) {
    return true;
  }

  const normalized = normalizeSeed(seed);
  if (normalized === DEFAULT_NON_ZERO_SEED && seed !== DEFAULT_NON_ZERO_SEED) {
    return true;
  }

  const entropy = computeSeedEntropy(normalized);
  return entropy < 1.0;
}

/**
 * Creates a ledger-seeded derivation map where each ledger field value
 * from a replay snapshot influences the seed derivation for that field's
 * subsystem in the next tick.
 */
export function deriveSeedsFromReplaySnapshot(
  snapshot: ReplaySnapshot,
): Record<string, number> {
  const result: Record<string, number> = {};
  const baseSeed = normalizeSeed(snapshot.seed);

  const ledgerFields: (keyof Ledger)[] = [
    'cash', 'income', 'expenses', 'shield',
    'heat', 'trust', 'divergence', 'cords', 'turn',
  ];

  for (const field of ledgerFields) {
    const fieldValue = snapshot.ledger[field];
    const fieldSalt = `snapshot:${snapshot.runId}:${field}:${round6(fieldValue)}:turn:${snapshot.turnCount}`;
    const derived = combineSeed(baseSeed, fieldSalt);
    result[field] = normalizeSeed(derived);
  }

  return result;
}

/**
 * Performs a complete seed health check combining all verification,
 * entropy, distribution, and mode compatibility analyses.
 */
export function performCompleteSeedHealthCheck(
  seed: number,
  mode: GameMode,
): {
  readonly seed: number;
  readonly integrity: ReturnType<typeof validateSeedIntegrity>;
  readonly quality: SeedQualityReport;
  readonly modeProfile: SeedModeProfile;
  readonly modeCompatibility: Record<string, number>;
  readonly ghostReadiness: boolean;
  readonly overallHealthy: boolean;
} {
  const normalizedSeed = normalizeSeed(seed);
  const integrity = validateSeedIntegrity(normalizedSeed);
  const quality = getSeedQualityReport(normalizedSeed);
  const modeProfile = buildSeedModeProfile(normalizedSeed, mode);
  const modeCompatibility = computeSeedModeCompatibility(normalizedSeed);

  const ghostReadiness = mode === GameMode.CHASE_A_LEGEND
    ? modeProfile.ghostEnabled
    : false;

  const overallHealthy = integrity.valid
    && (quality.overallGrade === 'A' || quality.overallGrade === 'B');

  return {
    seed: normalizedSeed,
    integrity,
    quality,
    modeProfile,
    modeCompatibility,
    ghostReadiness,
    overallHealthy,
  };
}
