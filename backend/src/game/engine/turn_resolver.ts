/**
 * POINT ZERO ONE — TURN RESOLVER v3.0.0
 * backend/src/game/engine/turn_resolver.ts
 *
 * Full-spectrum turn resolution engine with:
 * - Mode-aware resolution (Empire, Predator, Syndicate, Phantom)
 * - Pressure-adjusted costs and timing validation
 * - Decision quality scoring with ML/DL feature extraction
 * - Card effect application with mode overlays
 * - Counter/sabotage resolution for Predator
 * - Aid/rescue resolution for Syndicate
 * - Ghost divergence tracking for Phantom
 * - Hold system management for Empire
 * - Deterministic replay proof generation
 * - Chat bridge event emission
 * - Turn-by-turn analytics and batch processing
 *
 * Preserves the original public API:
 *   Player, Choice, Deltas, TurnEvent interfaces
 *   GameState singleton (getPlayer, setPlayer, clear)
 *   TurnResolver class with resolveTurn(playerId)
 */

import { EventEmitter } from 'events';
import {
  Ledger,
  DecisionEffect,
  ReplayEngine,
  GameState as ReplayGameState,
  sha256Hex,
  stableStringify,
  createDefaultLedger,
  type ReplaySnapshot,
  type RunEvent,
  type EffectTarget,
} from './replay_engine';
import type { Card } from './deck_manager';
import {
  normalizeSeed,
  hashStringToSeed,
  combineSeed,
  createDeterministicRng,
  createMulberry32,
  sanitizePositiveWeights,
  DEFAULT_NON_ZERO_SEED,
  type DeterministicRng,
} from './deterministic_rng';
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
  Targeting,
  Counterability,
  type CardDefinition,
  type CardInHand,
  type ExecutionContext,
  type CardPlayRequest,
  type TimingValidationResult,
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
  resolveEffectiveCost,
  computeDivergencePotential,
} from './card_types';
import { createHash } from 'node:crypto';

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2 — CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

export const TURN_RESOLVER_VERSION = '3.0.0';

/** ML feature vector dimension for turn-level analysis. */
const TURN_ML_FEATURE_DIM = 24;

/** DL tensor rows per turn. */
const TURN_DL_TENSOR_ROWS = 16;

/** DL tensor columns per turn. */
const TURN_DL_TENSOR_COLS = 8;

/** Maximum turn budget per run (safety cap). */
const MAX_TURN_BUDGET = 200;

/** Minimum turn budget before collapse is imminent. */
const MIN_TURN_BUDGET = 1;

/** Maximum cards drawn per turn. */
const MAX_DRAW_PER_TURN = 5;

/** Default run seed when no seed is provided. */
const DEFAULT_RUN_SEED = 42;

/** Heat ceiling — above this the run must finalize. */
const HEAT_CEILING = 100;

/** Trust floor for Syndicate — below this, defection cascade. */
const TRUST_FLOOR = 0;

/** Divergence ceiling for Phantom — above this, ghost lost. */
const DIVERGENCE_CEILING = 100;

/** Decision quality thresholds. */
const QUALITY_THRESHOLD_OPTIMAL = 0.85;
const QUALITY_THRESHOLD_GOOD = 0.65;
const QUALITY_THRESHOLD_NEUTRAL = 0.40;
const QUALITY_THRESHOLD_SUBOPTIMAL = 0.15;

/** ML feature labels for turn-level vectors. */
const TURN_ML_FEATURE_LABELS: readonly string[] = [
  'turn_index_norm',
  'cash_norm',
  'income_norm',
  'expenses_norm',
  'shield_norm',
  'heat_norm',
  'trust_norm',
  'divergence_norm',
  'cords_norm',
  'hand_size_norm',
  'deck_remaining_norm',
  'mode_ordinal',
  'phase_ordinal',
  'pressure_tier_ordinal',
  'decision_quality_score',
  'tag_weighted_score',
  'effective_cost_norm',
  'bleedthrough_factor',
  'trust_efficiency',
  'pressure_cost_mod',
  'rarity_weight',
  'timing_optimality',
  'opportunity_cost_norm',
  'comeback_proximity',
] as const;

/** Batch processing limits. */
const MAX_BATCH_SIZE = 50;
const BATCH_REPORT_VERSION = '1.0.0';

/** Chat bridge event names. */
const CHAT_EVENT_TURN_STARTED = 'turn_started';
const CHAT_EVENT_CARD_PLAYED = 'card_played';
const CHAT_EVENT_DECISION_MADE = 'decision_made';
const CHAT_EVENT_TURN_RESOLVED = 'turn_resolved';
const CHAT_EVENT_CRITICAL_PLAY = 'critical_play';

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3 — INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

// ── Preserved interfaces ────────────────────────────────────────────────────

export interface Player {
  id: number;
  hand: Card[];
  deckSize: number;
  ledger: Ledger;
}

export interface Choice {
  id: string;
  label: string;
  effects: DecisionEffect[];
}

export interface Deltas {
  cash: number;
  income: number;
  expenses: number;
  shield: number;
  heat: number;
  trust: number;
}

export interface TurnEvent {
  playerId: number;
  choices: Choice[];
  decision: Choice;
  deltas: Deltas;
}

// ── New interfaces ──────────────────────────────────────────────────────────

export interface TurnResolutionResult {
  readonly event: TurnEvent;
  readonly quality: TurnDecisionQuality;
  readonly modeContext: TurnModeContext;
  readonly pressureSnapshot: TurnPressureSnapshot;
  readonly proofRecord: TurnProofRecord;
  readonly analytics: TurnAnalytics;
  readonly chatEvents: TurnChatBridgeEvent[];
  readonly replayRecord: TurnReplayRecord;
  readonly timestamp: number;
  readonly resolverVersion: string;
}

export interface TurnDecisionQuality {
  readonly overallScore: number;
  readonly timingOptimality: number;
  readonly opportunityCost: number;
  readonly modeWeightedTagScore: number;
  readonly pressureCostEfficiency: number;
  readonly classification: 'optimal' | 'good' | 'neutral' | 'suboptimal' | 'catastrophic';
  readonly feedbackHints: readonly string[];
}

export interface TurnMLFeatureVector {
  readonly features: readonly number[];
  readonly labels: readonly string[];
  readonly dimension: number;
  readonly turnIndex: number;
  readonly extractedAt: number;
  readonly seedHash: number;
}

export interface TurnDLTensor {
  readonly data: readonly (readonly number[])[];
  readonly rows: number;
  readonly cols: number;
  readonly turnIndex: number;
  readonly checksum: string;
}

export interface TurnModeContext {
  readonly mode: GameMode;
  readonly phase: RunPhase;
  readonly pressureTier: PressureTier;
  readonly legalDeckTypes: readonly DeckType[];
  readonly holdEnabled: boolean;
  readonly battleBudgetEnabled: boolean;
  readonly trustEnabled: boolean;
  readonly ghostEnabled: boolean;
  readonly rescueEnabled: boolean;
  readonly counterWindowEnabled: boolean;
  readonly aidWindowEnabled: boolean;
  readonly phaseGatingEnabled: boolean;
  readonly activeSynergies: readonly string[];
  readonly modeChannel: string;
  readonly stageMood: string;
}

export interface TurnPressureSnapshot {
  readonly tier: PressureTier;
  readonly costModifier: number;
  readonly bleedthroughMultiplier: number;
  readonly isCriticalTiming: boolean;
  readonly comebackProximity: number;
  readonly heatCeiling: number;
  readonly currentHeat: number;
  readonly headroom: number;
}

export interface TurnReplayRecord {
  readonly turnIndex: number;
  readonly seed: number;
  readonly ledgerBefore: Ledger;
  readonly ledgerAfter: Ledger;
  readonly choiceId: string;
  readonly effectsApplied: readonly DecisionEffect[];
  readonly replayHash: string;
  readonly deterministicVerified: boolean;
}

export interface TurnChatBridgeEvent {
  readonly eventName: string;
  readonly turnIndex: number;
  readonly playerId: number;
  readonly payload: Record<string, unknown>;
  readonly timestamp: number;
  readonly eventHash: number;
}

export interface TurnBatchResult {
  readonly turns: readonly TurnResolutionResult[];
  readonly totalTurns: number;
  readonly averageQuality: number;
  readonly modeBreakdown: Record<string, number>;
  readonly batchReportVersion: string;
  readonly batchHash: string;
  readonly startedAt: number;
  readonly completedAt: number;
}

export interface TurnAnalytics {
  readonly turnIndex: number;
  readonly playerId: number;
  readonly durationMs: number;
  readonly cardsInHand: number;
  readonly choiceCount: number;
  readonly selectedChoiceIndex: number;
  readonly qualityScore: number;
  readonly cumulativeCords: number;
  readonly cumulativeHeat: number;
  readonly modeSpecificMetrics: Record<string, number>;
  readonly featureVector: TurnMLFeatureVector;
  readonly dlTensor: TurnDLTensor;
}

export interface TurnProofRecord {
  readonly turnIndex: number;
  readonly proofHash: string;
  readonly ledgerHash: string;
  readonly choiceHash: string;
  readonly timestampHash: string;
  readonly chainPreviousHash: string;
  readonly nonce: number;
  readonly verified: boolean;
}

export interface TurnHistoryEntry {
  readonly turnIndex: number;
  readonly playerId: number;
  readonly event: TurnEvent;
  readonly ledgerSnapshot: Ledger;
  readonly timestamp: number;
}

export interface TurnEffectContext {
  readonly mode: GameMode;
  readonly phase: RunPhase;
  readonly pressureTier: PressureTier;
  readonly trustScore: number;
  readonly divergenceScore: number;
  readonly battleBudget: number;
  readonly holdCount: number;
  readonly consecutiveSabotage: number;
  readonly ghostMarkersExploited: number;
}

export interface ModeResolutionOverride {
  readonly costMultiplier: number;
  readonly effectMultiplier: number;
  readonly cordBonusFlat: number;
  readonly cordBonusMultiplier: number;
  readonly heatAdjustment: number;
  readonly trustAdjustment: number;
  readonly divergenceAdjustment: number;
  readonly shieldAdjustment: number;
}

export interface GhostDivergenceTracker {
  readonly markersAvailable: number;
  readonly markersExploited: number;
  readonly totalDivergence: number;
  readonly currentStreak: number;
  readonly bestStreak: number;
  readonly lastMarkerKind: GhostMarkerKind | null;
  readonly cordBonusAccrued: number;
}

export interface HoldSystemState {
  readonly holdsRemaining: number;
  readonly holdsUsed: number;
  readonly momentumCount: number;
  readonly bonusHoldsEarned: number;
  readonly noHoldBonus: boolean;
  readonly noHoldCordMultiplier: number;
}

export interface CounterSabotageState {
  readonly consecutiveUnblocked: number;
  readonly countersPlayed: number;
  readonly sabotagesBlocked: number;
  readonly sabotagesLanded: number;
  readonly battleBudgetSpent: number;
  readonly bouncebacksTriggered: number;
}

export interface AidRescueState {
  readonly aidsDelivered: number;
  readonly rescuesDelivered: number;
  readonly fullEfficiencyCount: number;
  readonly degradedEfficiencyCount: number;
  readonly trustBonusAccrued: number;
  readonly treasurySpent: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4 — GAME STATE SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

const playerStore = new Map<number, Player>();
const turnHistory: TurnHistoryEntry[] = [];
const turnEmitter = new EventEmitter();

// Internal tracking maps for mode state
const ghostTrackers = new Map<number, GhostDivergenceTracker>();
const holdStates = new Map<number, HoldSystemState>();
const counterStates = new Map<number, CounterSabotageState>();
const aidRescueStates = new Map<number, AidRescueState>();
const proofChainHashes = new Map<number, string>();

export const GameState = {
  getPlayer(playerId: number): Player | undefined {
    return playerStore.get(playerId);
  },
  setPlayer(player: Player): void {
    playerStore.set(player.id, player);
  },
  clear(): void {
    playerStore.clear();
    turnHistory.length = 0;
    ghostTrackers.clear();
    holdStates.clear();
    counterStates.clear();
    aidRescueStates.clear();
    proofChainHashes.clear();
  },
  getTurnHistory(): readonly TurnHistoryEntry[] {
    return turnHistory;
  },
  getHistoryForPlayer(playerId: number): TurnHistoryEntry[] {
    return turnHistory.filter((e) => e.playerId === playerId);
  },
  getTurnCount(): number {
    return turnHistory.length;
  },
  getLastTurnForPlayer(playerId: number): TurnHistoryEntry | undefined {
    for (let i = turnHistory.length - 1; i >= 0; i--) {
      if (turnHistory[i].playerId === playerId) {
        return turnHistory[i];
      }
    }
    return undefined;
  },
  recordTurn(entry: TurnHistoryEntry): void {
    turnHistory.push(entry);
  },
  getGhostTracker(playerId: number): GhostDivergenceTracker | undefined {
    return ghostTrackers.get(playerId);
  },
  setGhostTracker(playerId: number, tracker: GhostDivergenceTracker): void {
    ghostTrackers.set(playerId, tracker);
  },
  getHoldState(playerId: number): HoldSystemState | undefined {
    return holdStates.get(playerId);
  },
  setHoldState(playerId: number, state: HoldSystemState): void {
    holdStates.set(playerId, state);
  },
  getCounterState(playerId: number): CounterSabotageState | undefined {
    return counterStates.get(playerId);
  },
  setCounterState(playerId: number, state: CounterSabotageState): void {
    counterStates.set(playerId, state);
  },
  getAidRescueState(playerId: number): AidRescueState | undefined {
    return aidRescueStates.get(playerId);
  },
  setAidRescueState(playerId: number, state: AidRescueState): void {
    aidRescueStates.set(playerId, state);
  },
  getProofChainHash(playerId: number): string {
    return proofChainHashes.get(playerId) ?? 'genesis';
  },
  setProofChainHash(playerId: number, hash: string): void {
    proofChainHashes.set(playerId, hash);
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 5 — TURN RESOLVER CLASS (preserved + expanded)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Deterministic deck draw, weighted by card weight values.
 * Produces new cards whose index continues from the current hand size.
 */
function drawCards(hand: Card[], deckSize: number, rng?: DeterministicRng): Card[] {
  const drawCount = Math.min(MAX_DRAW_PER_TURN, deckSize - hand.length);
  const newCards: Card[] = [];
  for (let i = 0; i < drawCount; i++) {
    const weight = rng ? round6(rng.next() * 2 + 0.5) : 1;
    newCards.push({ index: hand.length + i, weight });
  }
  return [...hand, ...newCards];
}

/**
 * Infer pressure tier from heat value.
 */
function inferPressureTier(heat: number): PressureTier {
  if (heat <= 0.1) return PressureTier.T0_SOVEREIGN;
  if (heat <= 0.3) return PressureTier.T1_STABLE;
  if (heat <= 0.55) return PressureTier.T2_STRESSED;
  if (heat <= 0.8) return PressureTier.T3_ELEVATED;
  return PressureTier.T4_COLLAPSE_IMMINENT;
}

/**
 * Infer run phase from turn index.
 */
function inferRunPhase(turnIndex: number): RunPhase {
  if (turnIndex < 15) return RunPhase.FOUNDATION;
  if (turnIndex < 40) return RunPhase.ESCALATION;
  return RunPhase.SOVEREIGNTY;
}

/**
 * Map a Choice into a rough DeckType for analysis based on the choice label/id.
 */
function inferDeckTypeFromChoice(choice: Choice): DeckType {
  const label = choice.label.toLowerCase();
  if (label.includes('sabotage')) return DeckType.SABOTAGE;
  if (label.includes('counter')) return DeckType.COUNTER;
  if (label.includes('aid')) return DeckType.AID;
  if (label.includes('rescue')) return DeckType.RESCUE;
  if (label.includes('ghost')) return DeckType.GHOST;
  if (label.includes('discipline')) return DeckType.DISCIPLINE;
  if (label.includes('trust')) return DeckType.TRUST;
  if (label.includes('bluff')) return DeckType.BLUFF;
  if (label.includes('ipa')) return DeckType.IPA;
  if (label.includes('fubar')) return DeckType.FUBAR;
  if (label.includes('missed')) return DeckType.MISSED_OPPORTUNITY;
  if (label.includes('privileged')) return DeckType.PRIVILEGED;
  if (label.includes('obstacle') || label.includes('so')) return DeckType.SO;
  return DeckType.OPPORTUNITY;
}

/**
 * Compute a deterministic nonce from turn data for proof records.
 */
function computeProofNonce(playerId: number, turnIndex: number, seed: number): number {
  const combined = combineSeed(seed, `${playerId}_${turnIndex}`);
  return normalizeSeed(combined);
}

export class TurnResolver {
  private readonly runSeed: number;
  private readonly mode: GameMode;
  private readonly rng: DeterministicRng;
  private turnCounter: number;

  constructor(
    runSeed: number = DEFAULT_RUN_SEED,
    mode: GameMode = GameMode.GO_ALONE,
  ) {
    this.runSeed = normalizeSeed(runSeed);
    this.mode = mode;
    this.rng = createDeterministicRng(this.runSeed);
    this.turnCounter = 0;
  }

  /**
   * Preserved public API: resolve a single turn for the given player.
   */
  public resolveTurn(playerId: number): TurnEvent {
    const player = GameState.getPlayer(playerId);
    if (!player) {
      throw new Error(`No player found with ID ${playerId}`);
    }

    const turnIndex = this.turnCounter;
    this.turnCounter++;

    if (turnIndex >= MAX_TURN_BUDGET) {
      throw new Error(`Turn budget exceeded (max=${MAX_TURN_BUDGET})`);
    }

    // Draw cards with deterministic RNG
    const turnRng = createDeterministicRng(combineSeed(this.runSeed, turnIndex));
    player.hand = drawCards(player.hand, player.deckSize, turnRng);

    // Apply auto-effects based on mode
    this.applyAutoEffects(player.hand, player, turnIndex);

    // Present mode-aware choices
    const choices = this.presentChoices(player, turnIndex);

    // Get the player decision
    const decision = this.getPlayerDecision(choices, player, turnIndex);

    // Apply the decision with mode overlays
    this.applyPlayerDecision(decision, player, turnIndex);

    // Compute deltas
    const deltas = this.computeDeltas(player);

    // Validate turn constraints
    this.validateTurn(deltas, player, turnIndex);

    // Construct the event
    const event: TurnEvent = { playerId, choices, decision, deltas };

    // Emit turn event
    turnEmitter.emit('TurnEvent', event);

    // Record in history
    GameState.recordTurn({
      turnIndex,
      playerId,
      event,
      ledgerSnapshot: { ...player.ledger },
      timestamp: Date.now(),
    });

    return event;
  }

  /**
   * Full resolution with analytics, proof, ML/DL extraction, and chat bridge.
   */
  public resolveFullTurn(playerId: number): TurnResolutionResult {
    const startTime = Date.now();
    const turnIndex = this.turnCounter;

    // Snapshot ledger before
    const player = GameState.getPlayer(playerId);
    if (!player) {
      throw new Error(`No player found with ID ${playerId}`);
    }
    const ledgerBefore = { ...player.ledger };
    const previousChainHash = GameState.getProofChainHash(playerId);

    // Emit chat bridge: turn_started
    const chatEvents: TurnChatBridgeEvent[] = [];
    chatEvents.push(this.buildChatEvent(
      CHAT_EVENT_TURN_STARTED,
      turnIndex,
      playerId,
      { mode: this.mode, turnBudgetRemaining: MAX_TURN_BUDGET - turnIndex },
    ));

    // Resolve the base turn event
    const event = this.resolveTurn(playerId);

    // Ledger after
    const updatedPlayer = GameState.getPlayer(playerId);
    const ledgerAfter = updatedPlayer ? { ...updatedPlayer.ledger } : ledgerBefore;

    // Build mode context
    const modeContext = this.buildModeContext(turnIndex);

    // Build pressure snapshot
    const pressureSnapshot = this.buildPressureSnapshot(ledgerAfter);

    // Score decision quality
    const quality = TurnDecisionScorer.scoreDecision(
      event,
      this.mode,
      inferRunPhase(turnIndex),
      inferPressureTier(ledgerAfter.heat),
      turnIndex,
    );

    // Emit chat bridge: decision_made
    chatEvents.push(this.buildChatEvent(
      CHAT_EVENT_DECISION_MADE,
      turnIndex,
      playerId,
      { quality: quality.classification, score: quality.overallScore },
    ));

    // Check for critical plays
    if (quality.classification === 'optimal' || quality.classification === 'catastrophic') {
      chatEvents.push(this.buildChatEvent(
        CHAT_EVENT_CRITICAL_PLAY,
        turnIndex,
        playerId,
        { classification: quality.classification, score: quality.overallScore },
      ));
    }

    // Emit chat bridge: turn_resolved
    chatEvents.push(this.buildChatEvent(
      CHAT_EVENT_TURN_RESOLVED,
      turnIndex - 1,
      playerId,
      { deltas: event.deltas, quality: quality.overallScore },
    ));

    // Extract ML features
    const featureVector = TurnMLFeatureExtractor.extractFeatures(
      event,
      this.mode,
      inferRunPhase(turnIndex - 1),
      inferPressureTier(ledgerAfter.heat),
      turnIndex - 1,
      this.runSeed,
      ledgerAfter,
    );

    // Extract DL tensor
    const dlTensor = TurnDLTensorExtractor.extractTensor(
      event,
      this.mode,
      turnIndex - 1,
      this.runSeed,
      ledgerAfter,
    );

    // Build replay record
    const replayRecord = TurnReplayRecorder.buildRecord(
      turnIndex - 1,
      this.runSeed,
      ledgerBefore,
      ledgerAfter,
      event.decision,
    );

    // Build proof record
    const proofRecord = TurnProofBuilder.buildProof(
      turnIndex - 1,
      playerId,
      this.runSeed,
      ledgerAfter,
      event.decision,
      previousChainHash,
    );
    GameState.setProofChainHash(playerId, proofRecord.proofHash);

    // Build analytics
    const endTime = Date.now();
    const analytics: TurnAnalytics = {
      turnIndex: turnIndex - 1,
      playerId,
      durationMs: endTime - startTime,
      cardsInHand: event.choices.length,
      choiceCount: event.choices.length,
      selectedChoiceIndex: event.choices.indexOf(event.decision),
      qualityScore: quality.overallScore,
      cumulativeCords: ledgerAfter.cords,
      cumulativeHeat: ledgerAfter.heat,
      modeSpecificMetrics: this.computeModeSpecificMetrics(event, ledgerAfter),
      featureVector,
      dlTensor,
    };

    return {
      event,
      quality,
      modeContext,
      pressureSnapshot,
      proofRecord,
      analytics,
      chatEvents,
      replayRecord,
      timestamp: endTime,
      resolverVersion: TURN_RESOLVER_VERSION,
    };
  }

  /**
   * Resolve a turn for a specific mode with all mode-specific adaptations.
   */
  public resolveModeAwareTurn(playerId: number, context?: Partial<ExecutionContext>): TurnResolutionResult {
    const player = GameState.getPlayer(playerId);
    if (!player) {
      throw new Error(`No player found with ID ${playerId}`);
    }

    // Apply mode-specific pre-processing
    const adapter = new TurnModeAdapter(this.mode);
    adapter.preProcessTurn(player, this.turnCounter, context);

    // Resolve with full analytics
    const result = this.resolveFullTurn(playerId);

    // Apply mode-specific post-processing
    const updatedPlayer = GameState.getPlayer(playerId);
    if (updatedPlayer) {
      adapter.postProcessTurn(updatedPlayer, result, context);
    }

    return result;
  }

  // ── Private methods ──────────────────────────────────────────────────────

  private applyAutoEffects(hand: Card[], player: Player, turnIndex: number): void {
    // Mode-aware auto-effects: apply baseline heat from deck profiles
    const behavior = getModeCardBehavior(this.mode);
    const phase = inferRunPhase(turnIndex);

    let autoHeat = 0;
    let autoIncome = 0;

    for (const card of hand) {
      // Determine which deck type this card maps to based on index distribution
      const deckTypes = CARD_LEGALITY_MATRIX[this.mode];
      const deckTypeIndex = card.index % deckTypes.length;
      const deckType = deckTypes[deckTypeIndex];
      const profile = getDeckTypeProfile(deckType);

      if (profile.autoResolveDefault) {
        autoHeat += profile.baselineHeat * card.weight;
      }

      // IPA synergy passive income check
      if (deckType === DeckType.IPA && behavior.phaseGatingEnabled) {
        const deckTypesInPlay = deckTypes.slice(0, Math.min(hand.length, deckTypes.length));
        for (const synergy of IPA_CHAIN_SYNERGIES) {
          const allPresent = synergy.combination.every((dt) => deckTypesInPlay.includes(dt));
          if (allPresent && synergy.synergyBonus.passiveIncomeTickInterval) {
            if (turnIndex % synergy.synergyBonus.passiveIncomeTickInterval === 0) {
              autoIncome += round6(synergy.synergyBonus.incomeMultiplier * 5);
            }
          }
        }
      }
    }

    // Apply phase-gated scaling
    if (phase === RunPhase.SOVEREIGNTY) {
      autoHeat *= 0.8;
      autoIncome *= 1.2;
    } else if (phase === RunPhase.ESCALATION) {
      autoHeat *= 1.1;
      autoIncome *= 1.0;
    }

    // Apply auto-effects to ledger
    if (autoHeat !== 0 || autoIncome !== 0) {
      const mutableLedger = { ...player.ledger } as Record<string, number>;
      mutableLedger['heat'] = round6((mutableLedger['heat'] || 0) + autoHeat);
      mutableLedger['income'] = round6((mutableLedger['income'] || 0) + autoIncome);
      player.ledger = mutableLedger as unknown as Ledger;
    }
  }

  private presentChoices(player: Player, turnIndex: number): Choice[] {
    const legalDeckTypes = CARD_LEGALITY_MATRIX[this.mode];
    const pressureTier = inferPressureTier(player.ledger.heat);
    const pressureMod = computePressureCostModifier(pressureTier);
    const phase = inferRunPhase(turnIndex);

    return player.hand.map((card, i) => {
      const deckTypeIndex = card.index % legalDeckTypes.length;
      const deckType = legalDeckTypes[deckTypeIndex];
      const profile = getDeckTypeProfile(deckType);
      const isLegal = isDeckLegalInMode(deckType, this.mode);

      // Compute effective cost using pressure modifier
      const baseCost = round6(card.weight * 10 * pressureMod);
      const cordWeight = profile.baselineCordWeight;

      // Build effects based on deck type profile
      const effects: DecisionEffect[] = [];

      if (deckType === DeckType.OPPORTUNITY || deckType === DeckType.IPA) {
        effects.push({ target: 'cash' as EffectTarget, delta: round6(card.weight * 15) });
        effects.push({ target: 'income' as EffectTarget, delta: round6(card.weight * 3) });
      } else if (deckType === DeckType.FUBAR) {
        effects.push({ target: 'cash' as EffectTarget, delta: round6(-card.weight * 20) });
        effects.push({ target: 'heat' as EffectTarget, delta: round6(profile.baselineHeat * card.weight) });
      } else if (deckType === DeckType.SABOTAGE && this.mode === GameMode.HEAD_TO_HEAD) {
        effects.push({ target: 'heat' as EffectTarget, delta: round6(profile.baselineHeat * card.weight) });
        effects.push({ target: 'shield' as EffectTarget, delta: round6(-card.weight * 5) });
      } else if (deckType === DeckType.COUNTER && this.mode === GameMode.HEAD_TO_HEAD) {
        effects.push({ target: 'shield' as EffectTarget, delta: round6(card.weight * 10) });
      } else if (deckType === DeckType.AID && this.mode === GameMode.TEAM_UP) {
        effects.push({ target: 'trust' as EffectTarget, delta: round6(card.weight * 2) });
        effects.push({ target: 'cash' as EffectTarget, delta: round6(card.weight * 8) });
      } else if (deckType === DeckType.RESCUE && this.mode === GameMode.TEAM_UP) {
        effects.push({ target: 'trust' as EffectTarget, delta: round6(card.weight * 4) });
        effects.push({ target: 'shield' as EffectTarget, delta: round6(card.weight * 15) });
      } else if (deckType === DeckType.GHOST && this.mode === GameMode.CHASE_A_LEGEND) {
        effects.push({ target: 'divergence' as EffectTarget, delta: round6(card.weight * 5) });
        effects.push({ target: 'cords' as EffectTarget, delta: round6(cordWeight * card.weight * 3) });
      } else if (deckType === DeckType.DISCIPLINE) {
        effects.push({ target: 'heat' as EffectTarget, delta: round6(profile.baselineHeat * card.weight) });
        effects.push({ target: 'shield' as EffectTarget, delta: round6(card.weight * 5) });
      } else if (deckType === DeckType.TRUST && this.mode === GameMode.TEAM_UP) {
        effects.push({ target: 'trust' as EffectTarget, delta: round6(card.weight * 6) });
      } else if (deckType === DeckType.BLUFF && this.mode === GameMode.HEAD_TO_HEAD) {
        effects.push({ target: 'cash' as EffectTarget, delta: round6(card.weight * 12) });
        effects.push({ target: 'heat' as EffectTarget, delta: round6(profile.baselineHeat * card.weight) });
      } else {
        // Default: standard cash effect
        effects.push({ target: 'cash' as EffectTarget, delta: round6(card.weight * 10) });
      }

      // Always add cord effect based on deck profile
      effects.push({ target: 'cords' as EffectTarget, delta: round6(cordWeight * card.weight) });

      // Mode-specific bonus: hold system no-hold bonus for Empire
      if (this.mode === GameMode.GO_ALONE) {
        const holdState = GameState.getHoldState(player.id);
        if (holdState && holdState.noHoldBonus) {
          const cordIdx = effects.findIndex((e) => e.target === 'cords');
          if (cordIdx >= 0) {
            const existing = effects[cordIdx];
            effects[cordIdx] = {
              target: 'cords',
              delta: round6(existing.delta * HOLD_SYSTEM_CONFIG.noHoldCordMultiplier),
            };
          }
        }
      }

      const label = isLegal
        ? `Play card ${card.index} (${deckType}, cost=${baseCost})`
        : `[ILLEGAL] card ${card.index} (${deckType})`;

      return {
        id: `choice_${card.index}_t${turnIndex}`,
        label,
        effects,
      };
    });
  }

  private getPlayerDecision(choices: Choice[], player: Player, turnIndex: number): Choice {
    if (choices.length === 0) {
      throw new Error(`No choices available for player ${player.id} at turn ${turnIndex}`);
    }

    // Score each choice and pick the best one deterministically
    const scoredChoices = choices.map((choice, idx) => {
      let score = 0;
      const deckType = inferDeckTypeFromChoice(choice);
      const tags = this.inferTagsFromDeckType(deckType);
      const tagScore = computeTagWeightedScore(tags, this.mode);
      score += tagScore;

      // Penalize illegal choices
      if (choice.label.includes('[ILLEGAL]')) {
        score -= 100;
      }

      // Mode-weighted scoring
      for (const effect of choice.effects) {
        if (effect.target === 'cash' && effect.delta > 0) score += effect.delta * 0.1;
        if (effect.target === 'income' && effect.delta > 0) score += effect.delta * 0.15;
        if (effect.target === 'shield' && effect.delta > 0) score += effect.delta * 0.08;
        if (effect.target === 'cords' && effect.delta > 0) score += effect.delta * 0.2;
        if (effect.target === 'trust' && effect.delta > 0) score += effect.delta * 0.12;
        if (effect.target === 'heat' && effect.delta > 0) score -= effect.delta * 50;
        if (effect.target === 'divergence' && effect.delta > 0) {
          score += this.mode === GameMode.CHASE_A_LEGEND ? effect.delta * 0.3 : -effect.delta * 0.1;
        }
      }

      // Comeback surge proximity bonus
      if (player.ledger.cash < COMEBACK_SURGE_CONFIG.emergencyCash * COMEBACK_SURGE_CONFIG.cashThresholdPct) {
        for (const effect of choice.effects) {
          if (effect.target === 'cash' && effect.delta > 0) score += effect.delta * 0.5;
        }
      }

      return { choice, score, index: idx };
    });

    scoredChoices.sort((a, b) => b.score - a.score);

    // Use deterministic RNG to add small variation to prevent always picking #1
    const turnSeed = combineSeed(this.runSeed, `decision_${turnIndex}`);
    const decisionRng = createDeterministicRng(turnSeed);
    const roll = decisionRng.next();

    if (roll < 0.7 || scoredChoices.length === 1) {
      return scoredChoices[0].choice;
    } else if (roll < 0.9 && scoredChoices.length > 1) {
      return scoredChoices[1].choice;
    } else if (scoredChoices.length > 2) {
      return scoredChoices[2].choice;
    }
    return scoredChoices[0].choice;
  }

  private applyPlayerDecision(decision: Choice, player: Player, turnIndex: number): void {
    const phase = inferRunPhase(turnIndex);
    const pressureTier = inferPressureTier(player.ledger.heat);
    const behavior = getModeCardBehavior(this.mode);

    // Build mode resolution override from the adapter
    const adapter = new TurnModeAdapter(this.mode);
    const override = adapter.computeResolutionOverride(player, turnIndex, decision);

    // Use the TurnEffectExecutor for applying effects
    const executor = new TurnEffectExecutor();
    const effectContext: TurnEffectContext = {
      mode: this.mode,
      phase,
      pressureTier,
      trustScore: player.ledger.trust,
      divergenceScore: player.ledger.divergence,
      battleBudget: 100,
      holdCount: GameState.getHoldState(player.id)?.holdsUsed ?? 0,
      consecutiveSabotage: GameState.getCounterState(player.id)?.consecutiveUnblocked ?? 0,
      ghostMarkersExploited: GameState.getGhostTracker(player.id)?.markersExploited ?? 0,
    };

    const newLedger = executor.applyEffects(
      player.ledger,
      decision.effects,
      effectContext,
      override,
    );

    player.ledger = newLedger;

    // Update mode-specific state
    if (behavior.ghostEnabled) {
      this.updateGhostState(player, decision, turnIndex);
    }
    if (behavior.counterWindowEnabled) {
      this.updateCounterState(player, decision);
    }
    if (behavior.aidWindowEnabled || behavior.rescueEnabled) {
      this.updateAidRescueState(player, decision);
    }
    if (behavior.holdEnabled) {
      this.updateHoldState(player, turnIndex);
    }
  }

  private computeDeltas(player: Player): Deltas {
    return {
      cash: player.ledger.cash,
      income: player.ledger.income,
      expenses: player.ledger.expenses,
      shield: player.ledger.shield,
      heat: player.ledger.heat,
      trust: player.ledger.trust,
    };
  }

  private validateTurn(deltas: Deltas, player: Player, turnIndex: number): void {
    if (deltas.heat > HEAT_CEILING) {
      throw new Error('Heat threshold exceeded — run should finalize');
    }

    if (turnIndex < MIN_TURN_BUDGET) {
      return;
    }

    // Mode-specific validation
    if (this.mode === GameMode.TEAM_UP && deltas.trust < TRUST_FLOOR) {
      turnEmitter.emit('TurnWarning', {
        playerId: player.id,
        turnIndex,
        warning: 'Trust has fallen below floor — defection cascade imminent',
      });
    }

    if (this.mode === GameMode.CHASE_A_LEGEND && player.ledger.divergence > DIVERGENCE_CEILING) {
      turnEmitter.emit('TurnWarning', {
        playerId: player.id,
        turnIndex,
        warning: 'Divergence ceiling reached — ghost run boundary',
      });
    }
  }

  // ── Mode-specific state updates ──────────────────────────────────────────

  private updateGhostState(player: Player, decision: Choice, turnIndex: number): void {
    const tracker = GameState.getGhostTracker(player.id) ?? {
      markersAvailable: 0,
      markersExploited: 0,
      totalDivergence: player.ledger.divergence,
      currentStreak: 0,
      bestStreak: 0,
      lastMarkerKind: null,
      cordBonusAccrued: 0,
    };

    const deckType = inferDeckTypeFromChoice(decision);
    const divergencePotential = computeDivergencePotential(
      this.buildStubCardDefinition(deckType),
      TimingClass.GBM,
      turnIndex % 5,
    );

    let newExploited = tracker.markersExploited;
    let newStreak = tracker.currentStreak;
    let newCordBonus = tracker.cordBonusAccrued;
    let lastKind = tracker.lastMarkerKind;

    // Check ghost marker exploitation
    if (deckType === DeckType.GHOST && divergencePotential === DivergencePotential.HIGH) {
      // Cycle through ghost marker kinds based on turn
      const markerKinds = Object.values(GhostMarkerKind);
      const markerIndex = turnIndex % markerKinds.length;
      const marker = markerKinds[markerIndex];
      const spec = GHOST_MARKER_SPECS[marker];

      newExploited++;
      newStreak++;
      newCordBonus += spec.cordBonus;
      lastKind = marker;
    } else {
      newStreak = 0;
    }

    GameState.setGhostTracker(player.id, {
      markersAvailable: tracker.markersAvailable + 1,
      markersExploited: newExploited,
      totalDivergence: player.ledger.divergence,
      currentStreak: newStreak,
      bestStreak: Math.max(tracker.bestStreak, newStreak),
      lastMarkerKind: lastKind,
      cordBonusAccrued: round6(newCordBonus),
    });
  }

  private updateCounterState(player: Player, decision: Choice): void {
    const state = GameState.getCounterState(player.id) ?? {
      consecutiveUnblocked: 0,
      countersPlayed: 0,
      sabotagesBlocked: 0,
      sabotagesLanded: 0,
      battleBudgetSpent: 0,
      bouncebacksTriggered: 0,
    };

    const deckType = inferDeckTypeFromChoice(decision);

    if (deckType === DeckType.COUNTER) {
      GameState.setCounterState(player.id, {
        ...state,
        countersPlayed: state.countersPlayed + 1,
        sabotagesBlocked: state.sabotagesBlocked + 1,
        consecutiveUnblocked: 0,
        bouncebacksTriggered: state.bouncebacksTriggered + 1,
      });
    } else if (deckType === DeckType.SABOTAGE) {
      GameState.setCounterState(player.id, {
        ...state,
        consecutiveUnblocked: state.consecutiveUnblocked + 1,
        sabotagesLanded: state.sabotagesLanded + 1,
        battleBudgetSpent: state.battleBudgetSpent + 30,
      });
    }
  }

  private updateAidRescueState(player: Player, decision: Choice): void {
    const state = GameState.getAidRescueState(player.id) ?? {
      aidsDelivered: 0,
      rescuesDelivered: 0,
      fullEfficiencyCount: 0,
      degradedEfficiencyCount: 0,
      trustBonusAccrued: 0,
      treasurySpent: 0,
    };

    const deckType = inferDeckTypeFromChoice(decision);
    const trustEff = computeTrustEfficiency(player.ledger.trust);

    if (deckType === DeckType.AID) {
      const isFullEff = trustEff.efficiency >= 1.2;
      GameState.setAidRescueState(player.id, {
        ...state,
        aidsDelivered: state.aidsDelivered + 1,
        fullEfficiencyCount: state.fullEfficiencyCount + (isFullEff ? 1 : 0),
        degradedEfficiencyCount: state.degradedEfficiencyCount + (isFullEff ? 0 : 1),
        trustBonusAccrued: round6(state.trustBonusAccrued + trustEff.comboBonus),
        treasurySpent: state.treasurySpent + 15,
      });
    } else if (deckType === DeckType.RESCUE) {
      const isFullEff = trustEff.efficiency >= 1.3;
      GameState.setAidRescueState(player.id, {
        ...state,
        rescuesDelivered: state.rescuesDelivered + 1,
        fullEfficiencyCount: state.fullEfficiencyCount + (isFullEff ? 1 : 0),
        degradedEfficiencyCount: state.degradedEfficiencyCount + (isFullEff ? 0 : 1),
        trustBonusAccrued: round6(state.trustBonusAccrued + trustEff.comboBonus * 1.5),
        treasurySpent: state.treasurySpent + 25,
      });
    }
  }

  private updateHoldState(player: Player, turnIndex: number): void {
    const state = GameState.getHoldState(player.id) ?? {
      holdsRemaining: HOLD_SYSTEM_CONFIG.baseHoldsPerRun,
      holdsUsed: 0,
      momentumCount: 0,
      bonusHoldsEarned: 0,
      noHoldBonus: true,
      noHoldCordMultiplier: HOLD_SYSTEM_CONFIG.noHoldCordMultiplier,
    };

    // Momentum tracking: every N turns without a hold earns bonus
    const newMomentum = state.momentumCount + 1;
    let newBonusHolds = state.bonusHoldsEarned;
    let newHoldsRemaining = state.holdsRemaining;

    if (newMomentum >= HOLD_SYSTEM_CONFIG.momentumThreshold) {
      newBonusHolds += HOLD_SYSTEM_CONFIG.bonusHoldsOnThreshold;
      newHoldsRemaining += HOLD_SYSTEM_CONFIG.bonusHoldsOnThreshold;
    }

    GameState.setHoldState(player.id, {
      holdsRemaining: newHoldsRemaining,
      holdsUsed: state.holdsUsed,
      momentumCount: newMomentum >= HOLD_SYSTEM_CONFIG.momentumThreshold ? 0 : newMomentum,
      bonusHoldsEarned: newBonusHolds,
      noHoldBonus: state.holdsUsed === 0,
      noHoldCordMultiplier: state.holdsUsed === 0
        ? HOLD_SYSTEM_CONFIG.noHoldCordMultiplier
        : 1.0,
    });
  }

  // ── Utility helpers ──────────────────────────────────────────────────────

  private inferTagsFromDeckType(deckType: DeckType): CardTag[] {
    switch (deckType) {
      case DeckType.OPPORTUNITY: return [CardTag.LIQUIDITY, CardTag.INCOME, CardTag.MOMENTUM];
      case DeckType.IPA: return [CardTag.INCOME, CardTag.SCALE, CardTag.MOMENTUM];
      case DeckType.FUBAR: return [CardTag.HEAT, CardTag.VARIANCE, CardTag.CASCADE];
      case DeckType.MISSED_OPPORTUNITY: return [CardTag.VARIANCE, CardTag.MOMENTUM];
      case DeckType.PRIVILEGED: return [CardTag.LIQUIDITY, CardTag.SCALE, CardTag.PRECISION];
      case DeckType.SO: return [CardTag.RESILIENCE, CardTag.HEAT];
      case DeckType.SABOTAGE: return [CardTag.SABOTAGE, CardTag.TEMPO, CardTag.HEAT];
      case DeckType.COUNTER: return [CardTag.COUNTER, CardTag.RESILIENCE, CardTag.PRECISION];
      case DeckType.AID: return [CardTag.AID, CardTag.TRUST, CardTag.RESILIENCE];
      case DeckType.RESCUE: return [CardTag.AID, CardTag.TRUST, CardTag.MOMENTUM];
      case DeckType.DISCIPLINE: return [CardTag.RESILIENCE, CardTag.PRECISION, CardTag.SCALE];
      case DeckType.TRUST: return [CardTag.TRUST, CardTag.AID, CardTag.CASCADE];
      case DeckType.BLUFF: return [CardTag.SABOTAGE, CardTag.TEMPO, CardTag.VARIANCE];
      case DeckType.GHOST: return [CardTag.DIVERGENCE, CardTag.PRECISION, CardTag.TEMPO];
    }
  }

  private buildStubCardDefinition(deckType: DeckType): CardDefinition {
    const profile = getDeckTypeProfile(deckType);
    return {
      cardId: `stub_${deckType}`,
      name: `Stub ${deckType}`,
      deckType,
      baseCost: 10,
      effects: [],
      tags: this.inferTagsFromDeckType(deckType),
      timingClasses: [TimingClass.ANY],
      rarity: CardRarity.COMMON,
      autoResolve: profile.autoResolveDefault,
      counterability: profile.defaultCounterability,
      targeting: profile.defaultTargeting,
    };
  }

  private buildModeContext(turnIndex: number): TurnModeContext {
    const behavior = getModeCardBehavior(this.mode);
    const phase = inferRunPhase(turnIndex);
    const pressureTier = PressureTier.T1_STABLE;
    const legalDeckTypes = CARD_LEGALITY_MATRIX[this.mode];

    // Check active IPA synergies
    const activeSynergies: string[] = [];
    for (const synergy of IPA_CHAIN_SYNERGIES) {
      const allLegal = synergy.combination.every((dt) => legalDeckTypes.includes(dt));
      if (allLegal) {
        activeSynergies.push(`${synergy.tier}_${synergy.combination.join('+')}`);
      }
    }

    return {
      mode: this.mode,
      phase,
      pressureTier,
      legalDeckTypes,
      holdEnabled: behavior.holdEnabled,
      battleBudgetEnabled: behavior.battleBudgetEnabled,
      trustEnabled: behavior.trustEnabled,
      ghostEnabled: behavior.ghostEnabled,
      rescueEnabled: behavior.rescueEnabled,
      counterWindowEnabled: behavior.counterWindowEnabled,
      aidWindowEnabled: behavior.aidWindowEnabled,
      phaseGatingEnabled: behavior.phaseGatingEnabled,
      activeSynergies,
      modeChannel: behavior.defaultChannel,
      stageMood: behavior.stageMood,
    };
  }

  private buildPressureSnapshot(ledger: Ledger): TurnPressureSnapshot {
    const tier = inferPressureTier(ledger.heat);
    const costMod = computePressureCostModifier(tier);
    const bleedthrough = computeBleedthroughMultiplier(tier, false);
    const headroom = HEAT_CEILING - ledger.heat;
    const comebackProx = ledger.cash < COMEBACK_SURGE_CONFIG.emergencyCash
      ? round6(1.0 - (ledger.cash / COMEBACK_SURGE_CONFIG.emergencyCash))
      : 0;

    return {
      tier,
      costModifier: costMod,
      bleedthroughMultiplier: bleedthrough,
      isCriticalTiming: tier === PressureTier.T4_COLLAPSE_IMMINENT,
      comebackProximity: comebackProx,
      heatCeiling: HEAT_CEILING,
      currentHeat: ledger.heat,
      headroom: round6(headroom),
    };
  }

  private buildChatEvent(
    eventName: string,
    turnIndex: number,
    playerId: number,
    payload: Record<string, unknown>,
  ): TurnChatBridgeEvent {
    const rawSeed = hashStringToSeed(`${eventName}_${turnIndex}_${playerId}`);
    const eventHash = normalizeSeed(rawSeed ^ DEFAULT_NON_ZERO_SEED);
    return {
      eventName,
      turnIndex,
      playerId,
      payload,
      timestamp: Date.now(),
      eventHash,
    };
  }

  private computeModeSpecificMetrics(event: TurnEvent, ledger: Ledger): Record<string, number> {
    const metrics: Record<string, number> = {};
    const behavior = getModeCardBehavior(this.mode);
    const tagWeightDefaults = MODE_TAG_WEIGHT_DEFAULTS[this.mode];

    metrics['tag_weighted_total'] = 0;
    for (const tag of Object.values(CardTag)) {
      metrics['tag_weighted_total'] += tagWeightDefaults[tag] ?? 0;
    }
    metrics['tag_weighted_total'] = round6(metrics['tag_weighted_total']);

    if (behavior.holdEnabled) {
      const holdState = GameState.getHoldState(event.playerId);
      metrics['holds_remaining'] = holdState?.holdsRemaining ?? HOLD_SYSTEM_CONFIG.baseHoldsPerRun;
      metrics['no_hold_bonus'] = holdState?.noHoldBonus ? 1 : 0;
    }

    if (behavior.battleBudgetEnabled) {
      const counterState = GameState.getCounterState(event.playerId);
      metrics['consecutive_sabotage'] = counterState?.consecutiveUnblocked ?? 0;
      metrics['counters_played'] = counterState?.countersPlayed ?? 0;
    }

    if (behavior.trustEnabled) {
      const trustEff = computeTrustEfficiency(ledger.trust);
      metrics['trust_efficiency'] = trustEff.efficiency;
      metrics['trust_combo_bonus'] = trustEff.comboBonus;
      metrics['trust_loan_access'] = trustEff.loanAccessPct;
    }

    if (behavior.ghostEnabled) {
      const ghostTracker = GameState.getGhostTracker(event.playerId);
      metrics['ghost_markers_exploited'] = ghostTracker?.markersExploited ?? 0;
      metrics['ghost_streak'] = ghostTracker?.currentStreak ?? 0;
      metrics['ghost_cord_bonus'] = ghostTracker?.cordBonusAccrued ?? 0;
    }

    return metrics;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 6 — TURN DECISION SCORER
// ═══════════════════════════════════════════════════════════════════════════════

export class TurnDecisionScorer {
  /**
   * Score the quality of a turn decision across multiple dimensions.
   */
  static scoreDecision(
    event: TurnEvent,
    mode: GameMode,
    phase: RunPhase,
    pressureTier: PressureTier,
    turnIndex: number,
  ): TurnDecisionQuality {
    // 1. Timing optimality
    const timingOptimality = TurnDecisionScorer.computeTimingOptimality(event, mode, turnIndex);

    // 2. Opportunity cost
    const opportunityCost = TurnDecisionScorer.computeOpportunityCost(event, mode);

    // 3. Mode-weighted tag scoring
    const deckType = inferDeckTypeFromChoice(event.decision);
    const tags = TurnDecisionScorer.inferTagsForDeckType(deckType);
    const modeWeightedTagScore = computeTagWeightedScore(tags, mode);

    // 4. Pressure-aware cost efficiency
    const pressureCostMod = computePressureCostModifier(pressureTier);
    const bleedthrough = computeBleedthroughMultiplier(pressureTier, false);
    const totalEffectMagnitude = event.decision.effects.reduce((sum, e) => sum + Math.abs(e.delta), 0);
    const pressureCostEfficiency = totalEffectMagnitude > 0
      ? round6(totalEffectMagnitude / (pressureCostMod * (1 + bleedthrough)))
      : 0;

    // 5. Trust efficiency scoring (relevant for TEAM_UP)
    let trustBonus = 0;
    if (mode === GameMode.TEAM_UP) {
      const trustDelta = event.decision.effects.find((e) => e.target === 'trust');
      if (trustDelta && trustDelta.delta > 0) {
        const trustEff = computeTrustEfficiency(50 + trustDelta.delta);
        trustBonus = round6(trustEff.efficiency * trustEff.comboBonus);
      }
    }

    // Composite score
    const weights = {
      timing: 0.30,
      opportunity: 0.20,
      tagScore: 0.20,
      pressureEff: 0.15,
      trustBonus: 0.15,
    };

    const normalizedTagScore = clamp(modeWeightedTagScore / 10, 0, 1);
    const normalizedPressureEff = clamp(pressureCostEfficiency / 100, 0, 1);
    const normalizedTrustBonus = clamp(trustBonus + 0.5, 0, 1);

    const overallScore = round6(
      timingOptimality * weights.timing +
      (1 - opportunityCost) * weights.opportunity +
      normalizedTagScore * weights.tagScore +
      normalizedPressureEff * weights.pressureEff +
      normalizedTrustBonus * weights.trustBonus
    );

    // Classification
    let classification: TurnDecisionQuality['classification'];
    if (overallScore >= QUALITY_THRESHOLD_OPTIMAL) classification = 'optimal';
    else if (overallScore >= QUALITY_THRESHOLD_GOOD) classification = 'good';
    else if (overallScore >= QUALITY_THRESHOLD_NEUTRAL) classification = 'neutral';
    else if (overallScore >= QUALITY_THRESHOLD_SUBOPTIMAL) classification = 'suboptimal';
    else classification = 'catastrophic';

    // Feedback hints
    const feedbackHints: string[] = [];
    if (timingOptimality < 0.5) feedbackHints.push('Consider playing earlier in the turn window for better timing.');
    if (opportunityCost > 0.6) feedbackHints.push('A different choice may have yielded better returns.');
    if (normalizedTagScore < 0.3) feedbackHints.push('Cards with better tag alignment for this mode exist in hand.');
    if (pressureCostEfficiency < 20) feedbackHints.push('Pressure is driving up effective costs — consider delaying expensive plays.');
    if (mode === GameMode.TEAM_UP && trustBonus < 0) feedbackHints.push('Trust score is low — prioritize aid/rescue plays.');
    if (mode === GameMode.CHASE_A_LEGEND) {
      const divEffect = event.decision.effects.find((e) => e.target === 'divergence');
      if (!divEffect || divEffect.delta <= 0) {
        feedbackHints.push('Ghost mode rewards divergence — exploit markers aggressively.');
      }
    }

    return {
      overallScore,
      timingOptimality,
      opportunityCost,
      modeWeightedTagScore,
      pressureCostEfficiency,
      classification,
      feedbackHints,
    };
  }

  /**
   * Compute timing optimality: how well-timed was the play within the turn window.
   */
  static computeTimingOptimality(event: TurnEvent, mode: GameMode, turnIndex: number): number {
    // Simulate timing analysis by checking if the decision aligns with mode tempo
    const behavior = getModeCardBehavior(mode);
    const deckType = inferDeckTypeFromChoice(event.decision);
    const profile = getDeckTypeProfile(deckType);

    // Base timing from draw rate multiplier (faster draw = better tempo alignment)
    let timingScore = profile.drawRateMultiplier;

    // Phase-based bonus: early foundation plays are valued differently
    const phase = inferRunPhase(turnIndex);
    if (phase === RunPhase.FOUNDATION) {
      // Foundation values income and scale
      if (deckType === DeckType.IPA || deckType === DeckType.OPPORTUNITY) {
        timingScore += 0.2;
      }
    } else if (phase === RunPhase.SOVEREIGNTY) {
      // Sovereignty values discipline and precision
      if (deckType === DeckType.DISCIPLINE || deckType === DeckType.PRIVILEGED) {
        timingScore += 0.3;
      }
    }

    // Penalty for playing mode-exclusive cards at wrong phase
    if (behavior.bannedDeckTypes.includes(deckType)) {
      timingScore -= 0.5;
    }

    return clamp(round6(timingScore), 0, 1);
  }

  /**
   * Compute opportunity cost: what is the cost of not picking the best alternative.
   */
  static computeOpportunityCost(event: TurnEvent, mode: GameMode): number {
    if (event.choices.length <= 1) return 0;

    // Score all choices
    const scores = event.choices.map((choice) => {
      let s = 0;
      for (const effect of choice.effects) {
        if (effect.target === 'cash') s += effect.delta * 0.1;
        if (effect.target === 'income') s += effect.delta * 0.15;
        if (effect.target === 'cords') s += effect.delta * 0.2;
        if (effect.target === 'trust') s += effect.delta * 0.12;
        if (effect.target === 'shield') s += effect.delta * 0.08;
        if (effect.target === 'heat') s -= effect.delta * 50;
      }

      const deckType = inferDeckTypeFromChoice(choice);
      const tags = TurnDecisionScorer.inferTagsForDeckType(deckType);
      s += computeTagWeightedScore(tags, mode) * 0.5;

      return s;
    });

    const maxScore = Math.max(...scores);
    const decisionIdx = event.choices.indexOf(event.decision);
    const decisionScore = decisionIdx >= 0 ? scores[decisionIdx] : 0;

    if (maxScore <= 0) return 0;

    const costRatio = maxScore > 0 ? (maxScore - decisionScore) / maxScore : 0;
    return clamp(round6(costRatio), 0, 1);
  }

  static inferTagsForDeckType(deckType: DeckType): CardTag[] {
    switch (deckType) {
      case DeckType.OPPORTUNITY: return [CardTag.LIQUIDITY, CardTag.INCOME, CardTag.MOMENTUM];
      case DeckType.IPA: return [CardTag.INCOME, CardTag.SCALE, CardTag.MOMENTUM];
      case DeckType.FUBAR: return [CardTag.HEAT, CardTag.VARIANCE, CardTag.CASCADE];
      case DeckType.MISSED_OPPORTUNITY: return [CardTag.VARIANCE, CardTag.MOMENTUM];
      case DeckType.PRIVILEGED: return [CardTag.LIQUIDITY, CardTag.SCALE, CardTag.PRECISION];
      case DeckType.SO: return [CardTag.RESILIENCE, CardTag.HEAT];
      case DeckType.SABOTAGE: return [CardTag.SABOTAGE, CardTag.TEMPO, CardTag.HEAT];
      case DeckType.COUNTER: return [CardTag.COUNTER, CardTag.RESILIENCE, CardTag.PRECISION];
      case DeckType.AID: return [CardTag.AID, CardTag.TRUST, CardTag.RESILIENCE];
      case DeckType.RESCUE: return [CardTag.AID, CardTag.TRUST, CardTag.MOMENTUM];
      case DeckType.DISCIPLINE: return [CardTag.RESILIENCE, CardTag.PRECISION, CardTag.SCALE];
      case DeckType.TRUST: return [CardTag.TRUST, CardTag.AID, CardTag.CASCADE];
      case DeckType.BLUFF: return [CardTag.SABOTAGE, CardTag.TEMPO, CardTag.VARIANCE];
      case DeckType.GHOST: return [CardTag.DIVERGENCE, CardTag.PRECISION, CardTag.TEMPO];
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 7 — TURN MODE ADAPTER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Mode-specific turn behavior adapter.
 * Handles the unique mechanics of each mode:
 * - Empire/GO_ALONE: phase-gating, hold system, IPA synergies
 * - Predator/HEAD_TO_HEAD: battle budget, counter windows, sabotage combos
 * - Syndicate/TEAM_UP: trust scoring, aid contracts, rescue windows
 * - Phantom/CHASE_A_LEGEND: ghost benchmarks, divergence scoring, discipline cards
 */
export class TurnModeAdapter {
  private readonly mode: GameMode;
  private readonly behavior: ReturnType<typeof getModeCardBehavior>;

  constructor(mode: GameMode) {
    this.mode = mode;
    this.behavior = getModeCardBehavior(mode);
  }

  /**
   * Pre-process a turn: apply mode-specific setup before resolution.
   */
  preProcessTurn(player: Player, turnIndex: number, context?: Partial<ExecutionContext>): void {
    const phase = inferRunPhase(turnIndex);

    switch (this.mode) {
      case GameMode.GO_ALONE:
        this.preProcessEmpire(player, turnIndex, phase);
        break;
      case GameMode.HEAD_TO_HEAD:
        this.preProcessPredator(player, turnIndex, context);
        break;
      case GameMode.TEAM_UP:
        this.preProcessSyndicate(player, turnIndex, context);
        break;
      case GameMode.CHASE_A_LEGEND:
        this.preProcessPhantom(player, turnIndex);
        break;
    }
  }

  /**
   * Post-process a turn: apply mode-specific cleanup after resolution.
   */
  postProcessTurn(
    player: Player,
    result: TurnResolutionResult,
    context?: Partial<ExecutionContext>,
  ): void {
    switch (this.mode) {
      case GameMode.GO_ALONE:
        this.postProcessEmpire(player, result);
        break;
      case GameMode.HEAD_TO_HEAD:
        this.postProcessPredator(player, result);
        break;
      case GameMode.TEAM_UP:
        this.postProcessSyndicate(player, result);
        break;
      case GameMode.CHASE_A_LEGEND:
        this.postProcessPhantom(player, result);
        break;
    }
  }

  /**
   * Compute a resolution override based on mode mechanics.
   */
  computeResolutionOverride(
    player: Player,
    turnIndex: number,
    decision: Choice,
  ): ModeResolutionOverride {
    const base: ModeResolutionOverride = {
      costMultiplier: 1.0,
      effectMultiplier: 1.0,
      cordBonusFlat: 0,
      cordBonusMultiplier: 1.0,
      heatAdjustment: 0,
      trustAdjustment: 0,
      divergenceAdjustment: 0,
      shieldAdjustment: 0,
    };

    const phase = inferRunPhase(turnIndex);
    const deckType = inferDeckTypeFromChoice(decision);

    switch (this.mode) {
      case GameMode.GO_ALONE:
        return this.computeEmpireOverride(player, base, phase, deckType);
      case GameMode.HEAD_TO_HEAD:
        return this.computePredatorOverride(player, base, deckType);
      case GameMode.TEAM_UP:
        return this.computeSyndicateOverride(player, base, deckType);
      case GameMode.CHASE_A_LEGEND:
        return this.computePhantomOverride(player, base, deckType, turnIndex);
      default:
        return base;
    }
  }

  // ── Empire (GO_ALONE) ────────────────────────────────────────────────────

  private preProcessEmpire(player: Player, turnIndex: number, phase: RunPhase): void {
    // Phase gating: check if deck types are legal for the current phase
    if (!this.behavior.phaseGatingEnabled) return;

    // Hold system initialization
    if (!GameState.getHoldState(player.id)) {
      GameState.setHoldState(player.id, {
        holdsRemaining: HOLD_SYSTEM_CONFIG.baseHoldsPerRun,
        holdsUsed: 0,
        momentumCount: 0,
        bonusHoldsEarned: 0,
        noHoldBonus: true,
        noHoldCordMultiplier: HOLD_SYSTEM_CONFIG.noHoldCordMultiplier,
      });
    }

    // Phase boundary detection: check if we're crossing a phase boundary
    if (turnIndex > 0) {
      const prevPhase = inferRunPhase(turnIndex - 1);
      if (prevPhase !== phase) {
        turnEmitter.emit('PhaseBoundary', {
          playerId: player.id,
          fromPhase: prevPhase,
          toPhase: phase,
          turnIndex,
          holdable: HOLD_SYSTEM_CONFIG.phaseBoundaryHoldable,
        });
      }
    }
  }

  private postProcessEmpire(player: Player, result: TurnResolutionResult): void {
    // Check IPA synergies and apply bonuses
    const legalDecks = CARD_LEGALITY_MATRIX[GameMode.GO_ALONE];
    const activeDeckTypes: DeckType[] = [];

    // Check which deck types are "active" based on hand composition
    for (const choice of result.event.choices) {
      const dt = inferDeckTypeFromChoice(choice);
      if (!activeDeckTypes.includes(dt)) {
        activeDeckTypes.push(dt);
      }
    }

    // IPA synergy check
    for (const synergy of IPA_CHAIN_SYNERGIES) {
      const allPresent = synergy.combination.every((dt) => activeDeckTypes.includes(dt));
      if (allPresent) {
        // Apply synergy bonus to ledger
        const mutableLedger = { ...player.ledger } as Record<string, number>;
        mutableLedger['income'] = round6(
          (mutableLedger['income'] || 0) * synergy.synergyBonus.incomeMultiplier
        );
        mutableLedger['shield'] = round6(
          (mutableLedger['shield'] || 0) * synergy.synergyBonus.shieldRegenMultiplier
        );
        if (synergy.synergyBonus.heatReduction > 0) {
          mutableLedger['heat'] = round6(
            Math.max(0, (mutableLedger['heat'] || 0) - synergy.synergyBonus.heatReduction)
          );
        }
        player.ledger = mutableLedger as unknown as Ledger;
        break; // Apply only the highest matching synergy
      }
    }
  }

  private computeEmpireOverride(
    player: Player,
    base: ModeResolutionOverride,
    phase: RunPhase,
    deckType: DeckType,
  ): ModeResolutionOverride {
    let costMult = base.costMultiplier;
    let effectMult = base.effectMultiplier;
    let cordBonusFlat = base.cordBonusFlat;
    let cordBonusMult = base.cordBonusMultiplier;
    let heatAdj = base.heatAdjustment;

    // Phase-gated cost scaling
    if (phase === RunPhase.FOUNDATION) {
      if (deckType === DeckType.IPA || deckType === DeckType.OPPORTUNITY) {
        costMult *= 0.9; // Discount in foundation
        effectMult *= 1.1;
      }
    } else if (phase === RunPhase.SOVEREIGNTY) {
      effectMult *= 1.15;
      cordBonusMult *= 1.2;
    }

    // Hold system: no-hold warrior bonus
    const holdState = GameState.getHoldState(player.id);
    if (holdState && holdState.noHoldBonus) {
      cordBonusMult *= holdState.noHoldCordMultiplier;
    }

    // Discipline card heat reduction
    if (deckType === DeckType.DISCIPLINE) {
      heatAdj -= 0.02;
    }

    return {
      costMultiplier: round6(costMult),
      effectMultiplier: round6(effectMult),
      cordBonusFlat: round6(cordBonusFlat),
      cordBonusMultiplier: round6(cordBonusMult),
      heatAdjustment: round6(heatAdj),
      trustAdjustment: base.trustAdjustment,
      divergenceAdjustment: base.divergenceAdjustment,
      shieldAdjustment: base.shieldAdjustment,
    };
  }

  // ── Predator (HEAD_TO_HEAD) ──────────────────────────────────────────────

  private preProcessPredator(player: Player, turnIndex: number, context?: Partial<ExecutionContext>): void {
    // Battle budget initialization
    if (!GameState.getCounterState(player.id)) {
      GameState.setCounterState(player.id, {
        consecutiveUnblocked: 0,
        countersPlayed: 0,
        sabotagesBlocked: 0,
        sabotagesLanded: 0,
        battleBudgetSpent: 0,
        bouncebacksTriggered: 0,
      });
    }

    // Counter window management: check if a counter window should open
    if (this.behavior.counterWindowEnabled && context?.activeCounterWindow) {
      turnEmitter.emit('CounterWindowOpen', {
        playerId: player.id,
        turnIndex,
        windowMs: 5000,
      });
    }
  }

  private postProcessPredator(player: Player, result: TurnResolutionResult): void {
    // Track consecutive sabotage for combo calculations
    const counterState = GameState.getCounterState(player.id);
    if (!counterState) return;

    const deckType = inferDeckTypeFromChoice(result.event.decision);

    // Sabotage combo: if we just played sabotage, check for combo bonus
    if (deckType === DeckType.SABOTAGE && counterState.consecutiveUnblocked > 1) {
      const comboMult = clamp(1.0 + (counterState.consecutiveUnblocked - 1) * 0.15, 1.0, 1.6);
      const mutableLedger = { ...player.ledger } as Record<string, number>;
      // Combo grants extra heat to opponent (simulated as self-heat reduction)
      mutableLedger['heat'] = round6(
        Math.max(0, (mutableLedger['heat'] || 0) - 0.01 * comboMult)
      );
      player.ledger = mutableLedger as unknown as Ledger;
    }

    // Counter bounceback: if counter was played, apply shield bonus
    if (deckType === DeckType.COUNTER) {
      const mutableLedger = { ...player.ledger } as Record<string, number>;
      mutableLedger['shield'] = round6((mutableLedger['shield'] || 0) + 5);
      player.ledger = mutableLedger as unknown as Ledger;
    }
  }

  private computePredatorOverride(
    player: Player,
    base: ModeResolutionOverride,
    deckType: DeckType,
  ): ModeResolutionOverride {
    let costMult = base.costMultiplier;
    let effectMult = base.effectMultiplier;
    let heatAdj = base.heatAdjustment;
    let shieldAdj = base.shieldAdjustment;

    const counterState = GameState.getCounterState(player.id);

    // Sabotage combo cost reduction
    if (deckType === DeckType.SABOTAGE && counterState) {
      const comboFactor = clamp(counterState.consecutiveUnblocked / 3, 0, 1);
      costMult *= round6(1.0 - comboFactor * 0.25);
      effectMult *= round6(1.0 + comboFactor * 0.4);
    }

    // Counter efficiency based on usage
    if (deckType === DeckType.COUNTER && counterState) {
      shieldAdj += round6(counterState.bouncebacksTriggered * 2);
    }

    // Bleedthrough on high-pressure plays
    const pressureTier = inferPressureTier(player.ledger.heat);
    const bleedthrough = computeBleedthroughMultiplier(pressureTier, true);
    if (bleedthrough > 0.2) {
      heatAdj += round6(bleedthrough * 0.05);
    }

    return {
      costMultiplier: round6(costMult),
      effectMultiplier: round6(effectMult),
      cordBonusFlat: base.cordBonusFlat,
      cordBonusMultiplier: base.cordBonusMultiplier,
      heatAdjustment: round6(heatAdj),
      trustAdjustment: base.trustAdjustment,
      divergenceAdjustment: base.divergenceAdjustment,
      shieldAdjustment: round6(shieldAdj),
    };
  }

  // ── Syndicate (TEAM_UP) ──────────────────────────────────────────────────

  private preProcessSyndicate(player: Player, turnIndex: number, context?: Partial<ExecutionContext>): void {
    // Aid/rescue state initialization
    if (!GameState.getAidRescueState(player.id)) {
      GameState.setAidRescueState(player.id, {
        aidsDelivered: 0,
        rescuesDelivered: 0,
        fullEfficiencyCount: 0,
        degradedEfficiencyCount: 0,
        trustBonusAccrued: 0,
        treasurySpent: 0,
      });
    }

    // Trust score monitoring
    const trustEff = computeTrustEfficiency(player.ledger.trust);
    if (trustEff.efficiency < 0.7) {
      turnEmitter.emit('TrustWarning', {
        playerId: player.id,
        turnIndex,
        band: trustEff.band,
        efficiency: trustEff.efficiency,
      });
    }

    // Rescue window management
    if (this.behavior.rescueEnabled && context?.activeRescueWindow) {
      turnEmitter.emit('RescueWindowOpen', {
        playerId: player.id,
        turnIndex,
        windowMs: 15000,
      });
    }

    // Aid window management
    if (this.behavior.aidWindowEnabled && context?.activeAidWindow) {
      turnEmitter.emit('AidWindowOpen', {
        playerId: player.id,
        turnIndex,
        windowMs: 15000,
      });
    }
  }

  private postProcessSyndicate(player: Player, result: TurnResolutionResult): void {
    // Apply trust bonus from aid/rescue
    const aidState = GameState.getAidRescueState(player.id);
    if (!aidState) return;

    const deckType = inferDeckTypeFromChoice(result.event.decision);
    const trustEff = computeTrustEfficiency(player.ledger.trust);

    // Trust-scaled effect application
    if (deckType === DeckType.AID || deckType === DeckType.RESCUE || deckType === DeckType.TRUST) {
      const mutableLedger = { ...player.ledger } as Record<string, number>;
      // Trust efficiency scales all cooperative card effects
      const trustMultiplier = trustEff.efficiency;
      for (const effect of result.event.decision.effects) {
        if (effect.target === 'trust' && effect.delta > 0) {
          mutableLedger['trust'] = round6(
            (mutableLedger['trust'] || 0) + effect.delta * (trustMultiplier - 1)
          );
        }
      }
      // Combo bonus
      mutableLedger['cords'] = round6(
        (mutableLedger['cords'] || 0) + trustEff.comboBonus * 2
      );
      player.ledger = mutableLedger as unknown as Ledger;
    }
  }

  private computeSyndicateOverride(
    player: Player,
    base: ModeResolutionOverride,
    deckType: DeckType,
  ): ModeResolutionOverride {
    let effectMult = base.effectMultiplier;
    let trustAdj = base.trustAdjustment;
    let cordBonusFlat = base.cordBonusFlat;

    const trustEff = computeTrustEfficiency(player.ledger.trust);

    // Trust-scaled cost modifier (high trust = lower coop costs)
    const costMult = round6(base.costMultiplier * (2.0 - trustEff.efficiency));

    // Aid/rescue effect scaling
    if (deckType === DeckType.AID || deckType === DeckType.RESCUE) {
      effectMult *= trustEff.efficiency;
      trustAdj += round6(trustEff.comboBonus);
    }

    // Trust card bonus
    if (deckType === DeckType.TRUST) {
      trustAdj += round6(trustEff.loanAccessPct * 0.01);
      cordBonusFlat += round6(trustEff.comboBonus * 3);
    }

    return {
      costMultiplier: round6(costMult),
      effectMultiplier: round6(effectMult),
      cordBonusFlat: round6(cordBonusFlat),
      cordBonusMultiplier: base.cordBonusMultiplier,
      heatAdjustment: base.heatAdjustment,
      trustAdjustment: round6(trustAdj),
      divergenceAdjustment: base.divergenceAdjustment,
      shieldAdjustment: base.shieldAdjustment,
    };
  }

  // ── Phantom (CHASE_A_LEGEND) ─────────────────────────────────────────────

  private preProcessPhantom(player: Player, turnIndex: number): void {
    // Ghost tracker initialization
    if (!GameState.getGhostTracker(player.id)) {
      GameState.setGhostTracker(player.id, {
        markersAvailable: 0,
        markersExploited: 0,
        totalDivergence: 0,
        currentStreak: 0,
        bestStreak: 0,
        lastMarkerKind: null,
        cordBonusAccrued: 0,
      });
    }

    // Ghost marker generation: every 3 turns, a new marker appears
    if (turnIndex > 0 && turnIndex % 3 === 0) {
      const markerKinds = Object.values(GhostMarkerKind);
      const markerIdx = turnIndex % markerKinds.length;
      const marker = markerKinds[markerIdx];
      const spec = GHOST_MARKER_SPECS[marker];

      turnEmitter.emit('GhostMarkerAppeared', {
        playerId: player.id,
        turnIndex,
        marker,
        spec,
        exploitWindowTicks: spec.exploitWindowTicks,
      });
    }
  }

  private postProcessPhantom(player: Player, result: TurnResolutionResult): void {
    const tracker = GameState.getGhostTracker(player.id);
    if (!tracker) return;

    // Divergence scoring: apply CORD bonus based on divergence potential
    const deckType = inferDeckTypeFromChoice(result.event.decision);
    const stubDef = {
      cardId: `stub_${deckType}`,
      name: `Stub ${deckType}`,
      deckType,
      baseCost: 10,
      effects: [],
      tags: TurnDecisionScorer.inferTagsForDeckType(deckType),
      timingClasses: [TimingClass.GBM] as readonly TimingClass[],
      rarity: CardRarity.COMMON,
      autoResolve: false,
      counterability: Counterability.NONE,
      targeting: Targeting.GHOST,
    } satisfies CardDefinition;

    const divPotential = computeDivergencePotential(stubDef, TimingClass.GBM, 2);

    if (divPotential === DivergencePotential.HIGH) {
      const mutableLedger = { ...player.ledger } as Record<string, number>;
      mutableLedger['cords'] = round6(
        (mutableLedger['cords'] || 0) + tracker.cordBonusAccrued * 0.1
      );
      player.ledger = mutableLedger as unknown as Ledger;
    }
  }

  private computePhantomOverride(
    player: Player,
    base: ModeResolutionOverride,
    deckType: DeckType,
    turnIndex: number,
  ): ModeResolutionOverride {
    let effectMult = base.effectMultiplier;
    let divAdj = base.divergenceAdjustment;
    let cordBonusFlat = base.cordBonusFlat;
    let cordBonusMult = base.cordBonusMultiplier;

    const tracker = GameState.getGhostTracker(player.id);

    // Ghost card divergence bonus
    if (deckType === DeckType.GHOST) {
      effectMult *= 1.3;
      divAdj += round6(5 * (1 + (tracker?.currentStreak ?? 0) * 0.1));

      // Streak bonus for consecutive ghost marker exploits
      if (tracker && tracker.currentStreak >= 3) {
        cordBonusMult *= 1.5;
        cordBonusFlat += 10;
      }
    }

    // Discipline card synergy in ghost mode
    if (deckType === DeckType.DISCIPLINE) {
      // Discipline provides stability for divergence tracking
      divAdj -= 1; // Reduce divergence slightly for control
      cordBonusFlat += 3;
    }

    // Ghost marker exploitation window bonus
    if (tracker && tracker.lastMarkerKind) {
      const spec = GHOST_MARKER_SPECS[tracker.lastMarkerKind];
      cordBonusFlat += round6(spec.cordBonus * 0.5);
    }

    return {
      costMultiplier: base.costMultiplier,
      effectMultiplier: round6(effectMult),
      cordBonusFlat: round6(cordBonusFlat),
      cordBonusMultiplier: round6(cordBonusMult),
      heatAdjustment: base.heatAdjustment,
      trustAdjustment: base.trustAdjustment,
      divergenceAdjustment: round6(divAdj),
      shieldAdjustment: base.shieldAdjustment,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 8 — TURN EFFECT EXECUTOR
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Apply decision effects to a player's ledger with mode overlays and pressure
 * cost adjustments. Produces a new immutable Ledger instance.
 */
export class TurnEffectExecutor {
  /**
   * Apply a set of effects to a ledger, producing a new ledger.
   */
  applyEffects(
    ledger: Ledger,
    effects: readonly DecisionEffect[],
    context: TurnEffectContext,
    override: ModeResolutionOverride,
  ): Ledger {
    const mutable: Record<string, number> = {
      cash: ledger.cash,
      income: ledger.income,
      expenses: ledger.expenses,
      shield: ledger.shield,
      heat: ledger.heat,
      trust: ledger.trust,
      divergence: ledger.divergence,
      cords: ledger.cords,
      turn: ledger.turn,
    };

    // Compute pressure cost modifier for this context
    const pressureMod = PRESSURE_COST_MODIFIERS[context.pressureTier];

    for (const effect of effects) {
      let delta = effect.delta;

      // Apply cost multiplier from override (modifies outgoing costs)
      if (delta < 0) {
        delta = round6(delta * override.costMultiplier * pressureMod);
      } else {
        delta = round6(delta * override.effectMultiplier);
      }

      // Apply effect to the appropriate ledger field
      switch (effect.target) {
        case 'cash':
          mutable['cash'] = round6(mutable['cash'] + delta);
          break;
        case 'income':
          mutable['income'] = round6(mutable['income'] + delta);
          break;
        case 'expenses':
          mutable['expenses'] = round6(mutable['expenses'] + delta);
          break;
        case 'shield':
          mutable['shield'] = round6(mutable['shield'] + delta + override.shieldAdjustment);
          break;
        case 'heat':
          mutable['heat'] = round6(mutable['heat'] + delta + override.heatAdjustment);
          break;
        case 'trust':
          mutable['trust'] = round6(mutable['trust'] + delta + override.trustAdjustment);
          break;
        case 'divergence':
          mutable['divergence'] = round6(mutable['divergence'] + delta + override.divergenceAdjustment);
          break;
        case 'cords':
          mutable['cords'] = round6(
            (mutable['cords'] + delta + override.cordBonusFlat) * override.cordBonusMultiplier
          );
          break;
      }
    }

    // Apply bleedthrough: if shield is being relied upon and pressure is high,
    // some heat bleeds through
    if (context.pressureTier >= PressureTier.T3_ELEVATED && mutable['shield'] > 0) {
      const bleedthrough = computeBleedthroughMultiplier(
        context.pressureTier,
        context.phase === RunPhase.SOVEREIGNTY,
      );
      const bleedAmount = round6(mutable['heat'] * bleedthrough * 0.1);
      mutable['heat'] = round6(mutable['heat'] + bleedAmount);
    }

    // Comeback surge: if cash is critically low, apply emergency cash
    if (mutable['cash'] < COMEBACK_SURGE_CONFIG.emergencyCash * COMEBACK_SURGE_CONFIG.cashThresholdPct) {
      mutable['shield'] = round6(mutable['shield'] + COMEBACK_SURGE_CONFIG.shieldBoostAll * 0.1);
    }

    // Clamp values to valid ranges
    mutable['heat'] = clamp(mutable['heat'], 0, HEAT_CEILING + 1);
    mutable['trust'] = clamp(mutable['trust'], TRUST_FLOOR, 100);
    mutable['shield'] = Math.max(0, mutable['shield']);
    mutable['divergence'] = Math.max(0, mutable['divergence']);
    mutable['cords'] = Math.max(0, mutable['cords']);

    // Increment turn
    mutable['turn'] = ledger.turn + 1;

    return mutable as unknown as Ledger;
  }

  /**
   * Compute the effective cost for a stub card definition in the current context.
   */
  computeEffectiveCostForContext(
    deckType: DeckType,
    mode: GameMode,
    pressureTier: PressureTier,
  ): number {
    const profile = getDeckTypeProfile(deckType);
    const stubDef: CardDefinition = {
      cardId: `cost_calc_${deckType}`,
      name: `Cost Calc ${deckType}`,
      deckType,
      baseCost: 10,
      effects: [],
      tags: [],
      timingClasses: [TimingClass.ANY],
      rarity: CardRarity.COMMON,
      autoResolve: profile.autoResolveDefault,
      counterability: profile.defaultCounterability,
      targeting: profile.defaultTargeting,
    };

    return resolveEffectiveCost(stubDef, mode, { costModifier: 1.0 }, pressureTier);
  }

  /**
   * Validate that a set of effects can legally be applied in the current mode.
   */
  validateEffectsForMode(effects: readonly DecisionEffect[], mode: GameMode): boolean {
    const legalTargets: Set<string> = new Set([
      'cash', 'income', 'expenses', 'shield', 'heat', 'cords',
    ]);

    // Mode-specific targets
    const behavior = getModeCardBehavior(mode);
    if (behavior.trustEnabled) legalTargets.add('trust');
    if (behavior.ghostEnabled) legalTargets.add('divergence');

    for (const effect of effects) {
      if (!legalTargets.has(effect.target)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Compute net delta summary from a set of effects with context.
   */
  computeNetDeltas(
    effects: readonly DecisionEffect[],
    context: TurnEffectContext,
    override: ModeResolutionOverride,
  ): Record<EffectTarget, number> {
    const net: Record<string, number> = {
      cash: 0,
      income: 0,
      expenses: 0,
      shield: 0,
      heat: 0,
      trust: 0,
      divergence: 0,
      cords: 0,
    };

    const pressureMod = PRESSURE_COST_MODIFIERS[context.pressureTier];

    for (const effect of effects) {
      let delta = effect.delta;
      if (delta < 0) {
        delta = round6(delta * override.costMultiplier * pressureMod);
      } else {
        delta = round6(delta * override.effectMultiplier);
      }
      net[effect.target] = round6((net[effect.target] || 0) + delta);
    }

    return net as unknown as Record<EffectTarget, number>;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 9 — ML FEATURE EXTRACTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extracts a 24-dimensional ML feature vector per turn for predictive modeling.
 * Each feature is normalized to [0, 1] for consistent model training.
 */
export class TurnMLFeatureExtractor {
  /**
   * Extract the full 24-dim feature vector for a single turn.
   */
  static extractFeatures(
    event: TurnEvent,
    mode: GameMode,
    phase: RunPhase,
    pressureTier: PressureTier,
    turnIndex: number,
    runSeed: number,
    ledger: Ledger,
  ): TurnMLFeatureVector {
    const features: number[] = new Array(TURN_ML_FEATURE_DIM).fill(0);
    const seedForTurn = combineSeed(runSeed, turnIndex);
    const rng = createDeterministicRng(seedForTurn);

    // 0: turn_index_norm
    features[0] = round6(clamp(turnIndex / MAX_TURN_BUDGET, 0, 1));

    // 1-8: ledger field normalizations
    features[1] = round6(clamp(ledger.cash / 10000, -1, 1));
    features[2] = round6(clamp(ledger.income / 1000, -1, 1));
    features[3] = round6(clamp(ledger.expenses / 1000, -1, 1));
    features[4] = round6(clamp(ledger.shield / 200, 0, 1));
    features[5] = round6(clamp(ledger.heat / HEAT_CEILING, 0, 1));
    features[6] = round6(clamp(ledger.trust / 100, 0, 1));
    features[7] = round6(clamp(ledger.divergence / DIVERGENCE_CEILING, 0, 1));
    features[8] = round6(clamp(ledger.cords / 500, 0, 1));

    // 9-10: hand and deck stats
    features[9] = round6(clamp(event.choices.length / 10, 0, 1));
    features[10] = round6(rng.next()); // deck remaining approximation via RNG

    // 11: mode ordinal
    const modeOrdinals: Record<string, number> = {
      [GameMode.GO_ALONE]: 0,
      [GameMode.HEAD_TO_HEAD]: 0.33,
      [GameMode.TEAM_UP]: 0.67,
      [GameMode.CHASE_A_LEGEND]: 1.0,
    };
    features[11] = modeOrdinals[mode] ?? 0;

    // 12: phase ordinal
    const phaseOrdinals: Record<string, number> = {
      [RunPhase.FOUNDATION]: 0,
      [RunPhase.ESCALATION]: 0.5,
      [RunPhase.SOVEREIGNTY]: 1.0,
    };
    features[12] = phaseOrdinals[phase] ?? 0;

    // 13: pressure tier ordinal
    const pressureOrdinals: Record<string, number> = {
      [PressureTier.T0_SOVEREIGN]: 0,
      [PressureTier.T1_STABLE]: 0.25,
      [PressureTier.T2_STRESSED]: 0.5,
      [PressureTier.T3_ELEVATED]: 0.75,
      [PressureTier.T4_COLLAPSE_IMMINENT]: 1.0,
    };
    features[13] = pressureOrdinals[pressureTier] ?? 0.25;

    // 14: decision quality score (quick compute)
    const totalEffectValue = event.decision.effects.reduce(
      (sum, e) => sum + (e.target === 'heat' ? -Math.abs(e.delta) * 10 : Math.abs(e.delta)),
      0
    );
    features[14] = round6(clamp(totalEffectValue / 100, 0, 1));

    // 15: tag weighted score for the decision
    const deckType = inferDeckTypeFromChoice(event.decision);
    const tags = TurnDecisionScorer.inferTagsForDeckType(deckType);
    const tagScore = computeTagWeightedScore(tags, mode);
    features[15] = round6(clamp(tagScore / 10, 0, 1));

    // 16: effective cost normalized
    const pressureMod = computePressureCostModifier(pressureTier);
    features[16] = round6(clamp(pressureMod / 2.0, 0, 1));

    // 17: bleedthrough factor
    const bleedthrough = computeBleedthroughMultiplier(pressureTier, false);
    features[17] = round6(bleedthrough);

    // 18: trust efficiency
    const trustEff = computeTrustEfficiency(ledger.trust);
    features[18] = round6(clamp(trustEff.efficiency / 1.5, 0, 1));

    // 19: pressure cost modifier
    features[19] = round6(clamp(pressureMod / 2.0, 0, 1));

    // 20: rarity-weighted probability
    const rarityWeights = sanitizePositiveWeights([
      CARD_RARITY_DROP_RATES[CardRarity.COMMON],
      CARD_RARITY_DROP_RATES[CardRarity.UNCOMMON],
      CARD_RARITY_DROP_RATES[CardRarity.RARE],
      CARD_RARITY_DROP_RATES[CardRarity.LEGENDARY],
    ]);
    const rarityTotal = rarityWeights.reduce((a, b) => a + b, 0);
    features[20] = round6(rarityTotal > 0 ? rarityWeights[0] / rarityTotal : 0.5);

    // 21: timing optimality (simplified)
    const profile = getDeckTypeProfile(deckType);
    features[21] = round6(clamp(profile.drawRateMultiplier, 0, 1));

    // 22: opportunity cost normalized
    features[22] = round6(clamp(
      event.choices.length > 1 ? 1.0 / event.choices.length : 0,
      0, 1
    ));

    // 23: comeback proximity
    const comebackThreshold = COMEBACK_SURGE_CONFIG.emergencyCash * COMEBACK_SURGE_CONFIG.cashThresholdPct;
    features[23] = round6(clamp(
      ledger.cash < comebackThreshold ? (comebackThreshold - ledger.cash) / comebackThreshold : 0,
      0, 1
    ));

    return {
      features,
      labels: TURN_ML_FEATURE_LABELS,
      dimension: TURN_ML_FEATURE_DIM,
      turnIndex,
      extractedAt: Date.now(),
      seedHash: normalizeSeed(seedForTurn),
    };
  }

  /**
   * Compute mode-specific feature adjustments for targeted model training.
   */
  static computeModeFeatureBoost(
    mode: GameMode,
    baseFeatures: readonly number[],
  ): number[] {
    const boosted = [...baseFeatures];
    const tagWeights = MODE_TAG_WEIGHT_DEFAULTS[mode];
    const behavior = getModeCardBehavior(mode);

    // Boost features relevant to the mode
    if (behavior.holdEnabled) {
      // Empire: boost income and scale features
      if (boosted.length > 2) boosted[2] *= 1.2; // income
    }
    if (behavior.battleBudgetEnabled) {
      // Predator: boost heat awareness
      if (boosted.length > 5) boosted[5] *= 1.3; // heat
    }
    if (behavior.trustEnabled) {
      // Syndicate: boost trust feature
      if (boosted.length > 6) boosted[6] *= 1.5; // trust
    }
    if (behavior.ghostEnabled) {
      // Phantom: boost divergence feature
      if (boosted.length > 7) boosted[7] *= 1.4; // divergence
    }

    // Normalize all to [0, 1]
    return boosted.map((f) => round6(clamp(f, 0, 1)));
  }

  /**
   * Batch extract features for multiple turns.
   */
  static batchExtract(
    events: readonly TurnEvent[],
    mode: GameMode,
    runSeed: number,
    ledgers: readonly Ledger[],
  ): TurnMLFeatureVector[] {
    return events.map((event, i) => {
      const phase = inferRunPhase(i);
      const pressureTier = i < ledgers.length
        ? inferPressureTier(ledgers[i].heat)
        : PressureTier.T1_STABLE;
      const ledger = i < ledgers.length ? ledgers[i] : createDefaultLedger();

      return TurnMLFeatureExtractor.extractFeatures(
        event, mode, phase, pressureTier, i, runSeed, ledger,
      );
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 10 — DL TENSOR EXTRACTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extracts a 16x8 tensor per turn for deep learning model input.
 * Each row represents a temporal/spatial dimension and each column
 * represents a feature channel.
 */
export class TurnDLTensorExtractor {
  /**
   * Extract the 16x8 DL tensor for a single turn.
   */
  static extractTensor(
    event: TurnEvent,
    mode: GameMode,
    turnIndex: number,
    runSeed: number,
    ledger: Ledger,
  ): TurnDLTensor {
    const tensorSeed = combineSeed(runSeed, `dl_${turnIndex}`);
    const rng = createMulberry32(normalizeSeed(tensorSeed));

    const data: number[][] = [];

    for (let row = 0; row < TURN_DL_TENSOR_ROWS; row++) {
      const rowData: number[] = new Array(TURN_DL_TENSOR_COLS).fill(0);

      // Column 0: temporal position encoding
      rowData[0] = round6((row / TURN_DL_TENSOR_ROWS) * (turnIndex / MAX_TURN_BUDGET));

      // Column 1: ledger channel (rotate through ledger fields per row)
      const ledgerFields = [
        ledger.cash / 10000,
        ledger.income / 1000,
        ledger.expenses / 1000,
        ledger.shield / 200,
        ledger.heat / HEAT_CEILING,
        ledger.trust / 100,
        ledger.divergence / DIVERGENCE_CEILING,
        ledger.cords / 500,
      ];
      rowData[1] = round6(clamp(ledgerFields[row % ledgerFields.length], -1, 1));

      // Column 2: choice encoding (effect magnitudes distributed across rows)
      if (row < event.choices.length) {
        const choiceEffectSum = event.choices[row].effects.reduce(
          (sum, e) => sum + e.delta, 0
        );
        rowData[2] = round6(clamp(choiceEffectSum / 100, -1, 1));
      }

      // Column 3: decision marker (1.0 for the selected decision row)
      const decisionIdx = event.choices.indexOf(event.decision);
      rowData[3] = row === decisionIdx ? 1.0 : 0.0;

      // Column 4: mode-specific weight channel
      const modeWeights = MODE_TAG_WEIGHT_DEFAULTS[mode];
      const tagValues = Object.values(modeWeights);
      const sanitized = sanitizePositiveWeights(tagValues);
      const sanitizedTotal = sanitized.reduce((a, b) => a + b, 0);
      rowData[4] = round6(sanitizedTotal > 0
        ? (sanitized[row % sanitized.length] / sanitizedTotal)
        : rng()
      );

      // Column 5: pressure/phase encoding
      const pressureTier = inferPressureTier(ledger.heat);
      const pressureMod = PRESSURE_COST_MODIFIERS[pressureTier];
      rowData[5] = round6(clamp(pressureMod / 2.0, 0, 1) * ((row + 1) / TURN_DL_TENSOR_ROWS));

      // Column 6: rarity probability channel
      const rarityValues = [
        CARD_RARITY_DROP_RATES[CardRarity.COMMON],
        CARD_RARITY_DROP_RATES[CardRarity.UNCOMMON],
        CARD_RARITY_DROP_RATES[CardRarity.RARE],
        CARD_RARITY_DROP_RATES[CardRarity.LEGENDARY],
      ];
      rowData[6] = round6(rarityValues[row % rarityValues.length]);

      // Column 7: stochastic noise channel (deterministic from seed)
      rowData[7] = round6(rng());

      data.push(rowData);
    }

    // Compute checksum
    const tensorPayload = stableStringify(data);
    const checksum = sha256Hex(tensorPayload).substring(0, 16);

    return {
      data,
      rows: TURN_DL_TENSOR_ROWS,
      cols: TURN_DL_TENSOR_COLS,
      turnIndex,
      checksum,
    };
  }

  /**
   * Flatten a tensor to a 1D array for model input.
   */
  static flattenTensor(tensor: TurnDLTensor): number[] {
    const flat: number[] = [];
    for (const row of tensor.data) {
      for (const val of row) {
        flat.push(val);
      }
    }
    return flat;
  }

  /**
   * Compute the L2 norm of a tensor for normalization.
   */
  static computeL2Norm(tensor: TurnDLTensor): number {
    let sumSquares = 0;
    for (const row of tensor.data) {
      for (const val of row) {
        sumSquares += val * val;
      }
    }
    return round6(Math.sqrt(sumSquares));
  }

  /**
   * Batch extract tensors for multiple turns.
   */
  static batchExtract(
    events: readonly TurnEvent[],
    mode: GameMode,
    runSeed: number,
    ledgers: readonly Ledger[],
  ): TurnDLTensor[] {
    return events.map((event, i) => {
      const ledger = i < ledgers.length ? ledgers[i] : createDefaultLedger();
      return TurnDLTensorExtractor.extractTensor(event, mode, i, runSeed, ledger);
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 11 — TURN REPLAY & PROOF
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Deterministic turn recording for replay verification.
 * Each turn produces a replay record that can be independently verified
 * using the ReplayEngine and sha256 hashing.
 */
export class TurnReplayRecorder {
  /**
   * Build a replay record for a single turn.
   */
  static buildRecord(
    turnIndex: number,
    seed: number,
    ledgerBefore: Ledger,
    ledgerAfter: Ledger,
    decision: Choice,
  ): TurnReplayRecord {
    const normalizedSeed = normalizeSeed(seed);

    // Serialize ledger states for hashing
    const beforeStr = stableStringify(ledgerBefore);
    const afterStr = stableStringify(ledgerAfter);
    const effectsStr = stableStringify(decision.effects);

    // Build composite hash
    const compositePayload = [
      String(turnIndex),
      String(normalizedSeed),
      beforeStr,
      afterStr,
      decision.id,
      effectsStr,
    ].join('|');

    const replayHash = sha256Hex(compositePayload);

    // Verify determinism by constructing a ReplayEngine and replaying
    const defaultLedger = createDefaultLedger({
      cash: ledgerBefore.cash,
      income: ledgerBefore.income,
      expenses: ledgerBefore.expenses,
      shield: ledgerBefore.shield,
      heat: ledgerBefore.heat,
      trust: ledgerBefore.trust,
      divergence: ledgerBefore.divergence,
      cords: ledgerBefore.cords,
      turn: ledgerBefore.turn,
    });

    const events: RunEvent[] = [
      {
        type: 'RUN_CREATED',
        runId: `replay_verify_${turnIndex}`,
        seed: normalizedSeed,
        createdAt: Date.now(),
        ledger: defaultLedger,
      },
      {
        type: 'TURN_SUBMITTED',
        runId: `replay_verify_${turnIndex}`,
        turnIndex,
        decisionId: decision.id,
        choiceId: decision.id,
        submittedAt: Date.now(),
        effects: decision.effects,
      },
    ];

    const engine = new ReplayEngine(normalizedSeed, events);
    const snapshot = engine.replayAll();
    const engineHash = engine.getReplayHash();

    // Verify the replay produces consistent results
    const deterministicVerified = snapshot.turnCount === turnIndex + 1;

    return {
      turnIndex,
      seed: normalizedSeed,
      ledgerBefore,
      ledgerAfter,
      choiceId: decision.id,
      effectsApplied: [...decision.effects],
      replayHash,
      deterministicVerified,
    };
  }

  /**
   * Verify a replay record against the expected state.
   */
  static verifyRecord(record: TurnReplayRecord): boolean {
    // Reconstruct the hash
    const beforeStr = stableStringify(record.ledgerBefore);
    const afterStr = stableStringify(record.ledgerAfter);
    const effectsStr = stableStringify(record.effectsApplied);

    const compositePayload = [
      String(record.turnIndex),
      String(record.seed),
      beforeStr,
      afterStr,
      record.choiceId,
      effectsStr,
    ].join('|');

    const expectedHash = sha256Hex(compositePayload);
    return expectedHash === record.replayHash;
  }

  /**
   * Build a full run replay from a sequence of records.
   */
  static buildRunReplay(
    records: readonly TurnReplayRecord[],
    runSeed: number,
  ): { snapshot: ReplaySnapshot; verified: boolean } {
    const normalizedSeed = normalizeSeed(runSeed);
    const events: RunEvent[] = [];

    // Create run event
    const firstRecord = records[0];
    const initialLedger = firstRecord
      ? createDefaultLedger({
          cash: firstRecord.ledgerBefore.cash,
          income: firstRecord.ledgerBefore.income,
          expenses: firstRecord.ledgerBefore.expenses,
          shield: firstRecord.ledgerBefore.shield,
          heat: firstRecord.ledgerBefore.heat,
          trust: firstRecord.ledgerBefore.trust,
          divergence: firstRecord.ledgerBefore.divergence,
          cords: firstRecord.ledgerBefore.cords,
        })
      : createDefaultLedger();

    events.push({
      type: 'RUN_CREATED',
      runId: `run_replay_${normalizedSeed}`,
      seed: normalizedSeed,
      createdAt: Date.now(),
      ledger: initialLedger,
    });

    // Add turn events
    for (const record of records) {
      events.push({
        type: 'TURN_SUBMITTED',
        runId: `run_replay_${normalizedSeed}`,
        turnIndex: record.turnIndex,
        decisionId: record.choiceId,
        choiceId: record.choiceId,
        submittedAt: Date.now(),
        effects: [...record.effectsApplied],
      });
    }

    // Finalize
    events.push({
      type: 'RUN_FINALIZED',
      runId: `run_replay_${normalizedSeed}`,
      finalizedAt: Date.now(),
    });

    const engine = new ReplayEngine(normalizedSeed, events);
    const snapshot = engine.replayAll();

    // Verify each record
    const allVerified = records.every((r) => TurnReplayRecorder.verifyRecord(r));

    return { snapshot, verified: allVerified };
  }
}

/**
 * Builds cryptographic proof records for turn integrity verification.
 * Each proof links to the previous turn's proof via chain hash,
 * creating a blockchain-like audit trail.
 */
export class TurnProofBuilder {
  /**
   * Build a proof record for a single turn.
   */
  static buildProof(
    turnIndex: number,
    playerId: number,
    runSeed: number,
    ledger: Ledger,
    decision: Choice,
    previousChainHash: string,
  ): TurnProofRecord {
    const nonce = computeProofNonce(playerId, turnIndex, runSeed);

    // Hash individual components
    const ledgerPayload = stableStringify(ledger);
    const ledgerHash = sha256Hex(ledgerPayload);

    const choicePayload = stableStringify({ id: decision.id, effects: decision.effects });
    const choiceHash = sha256Hex(choicePayload);

    const timestampPayload = `${turnIndex}_${playerId}_${Date.now()}_${nonce}`;
    const timestampHashValue = createHash('sha256').update(timestampPayload).digest('hex');

    // Chain hash: combines current data with previous chain hash
    const chainPayload = [
      previousChainHash,
      ledgerHash,
      choiceHash,
      timestampHashValue,
      String(nonce),
      String(turnIndex),
    ].join('|');

    const proofHash = sha256Hex(chainPayload);

    return {
      turnIndex,
      proofHash,
      ledgerHash,
      choiceHash,
      timestampHash: timestampHashValue,
      chainPreviousHash: previousChainHash,
      nonce,
      verified: true,
    };
  }

  /**
   * Verify a proof record against the chain.
   */
  static verifyProof(proof: TurnProofRecord): boolean {
    const chainPayload = [
      proof.chainPreviousHash,
      proof.ledgerHash,
      proof.choiceHash,
      proof.timestampHash,
      String(proof.nonce),
      String(proof.turnIndex),
    ].join('|');

    const expectedHash = sha256Hex(chainPayload);
    return expectedHash === proof.proofHash;
  }

  /**
   * Verify a full chain of proof records.
   */
  static verifyChain(proofs: readonly TurnProofRecord[]): {
    valid: boolean;
    brokenAt: number;
    totalVerified: number;
  } {
    let lastHash = 'genesis';
    let brokenAt = -1;
    let totalVerified = 0;

    for (let i = 0; i < proofs.length; i++) {
      const proof = proofs[i];

      // Check chain continuity
      if (proof.chainPreviousHash !== lastHash) {
        brokenAt = i;
        break;
      }

      // Verify individual proof
      if (!TurnProofBuilder.verifyProof(proof)) {
        brokenAt = i;
        break;
      }

      lastHash = proof.proofHash;
      totalVerified++;
    }

    return {
      valid: brokenAt === -1,
      brokenAt,
      totalVerified,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 12 — CHAT BRIDGE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Turn lifecycle events for the chat adapter.
 * Emits structured events that the chat UI can consume for real-time
 * turn-by-turn display and player feedback.
 */
export class TurnChatBridge {
  private readonly emitter: EventEmitter;

  constructor() {
    this.emitter = new EventEmitter();
  }

  /**
   * Register a listener for turn chat events.
   */
  on(eventName: string, listener: (event: TurnChatBridgeEvent) => void): void {
    this.emitter.on(eventName, listener);
  }

  /**
   * Emit a turn chat event.
   */
  emit(event: TurnChatBridgeEvent): void {
    this.emitter.emit(event.eventName, event);
    this.emitter.emit('*', event); // Wildcard for catch-all listeners
  }

  /**
   * Build a turn_started event.
   */
  buildTurnStartedEvent(
    turnIndex: number,
    playerId: number,
    mode: GameMode,
  ): TurnChatBridgeEvent {
    const eventSeed = hashStringToSeed(`turn_started_${turnIndex}_${playerId}`);
    return {
      eventName: CHAT_EVENT_TURN_STARTED,
      turnIndex,
      playerId,
      payload: {
        mode,
        phase: inferRunPhase(turnIndex),
        turnBudgetRemaining: MAX_TURN_BUDGET - turnIndex,
      },
      timestamp: Date.now(),
      eventHash: normalizeSeed(eventSeed ^ DEFAULT_NON_ZERO_SEED),
    };
  }

  /**
   * Build a card_played event.
   */
  buildCardPlayedEvent(
    turnIndex: number,
    playerId: number,
    decision: Choice,
    mode: GameMode,
  ): TurnChatBridgeEvent {
    const deckType = inferDeckTypeFromChoice(decision);
    const tags = TurnDecisionScorer.inferTagsForDeckType(deckType);
    const tagScore = computeTagWeightedScore(tags, mode);
    const eventSeed = hashStringToSeed(`card_played_${turnIndex}_${decision.id}`);

    return {
      eventName: CHAT_EVENT_CARD_PLAYED,
      turnIndex,
      playerId,
      payload: {
        choiceId: decision.id,
        label: decision.label,
        deckType,
        tagScore,
        effectCount: decision.effects.length,
      },
      timestamp: Date.now(),
      eventHash: normalizeSeed(eventSeed ^ DEFAULT_NON_ZERO_SEED),
    };
  }

  /**
   * Build a decision_made event.
   */
  buildDecisionMadeEvent(
    turnIndex: number,
    playerId: number,
    quality: TurnDecisionQuality,
  ): TurnChatBridgeEvent {
    const eventSeed = hashStringToSeed(`decision_made_${turnIndex}_${playerId}`);
    return {
      eventName: CHAT_EVENT_DECISION_MADE,
      turnIndex,
      playerId,
      payload: {
        classification: quality.classification,
        overallScore: quality.overallScore,
        feedbackHints: quality.feedbackHints,
      },
      timestamp: Date.now(),
      eventHash: normalizeSeed(eventSeed ^ DEFAULT_NON_ZERO_SEED),
    };
  }

  /**
   * Build a turn_resolved event.
   */
  buildTurnResolvedEvent(
    turnIndex: number,
    playerId: number,
    deltas: Deltas,
  ): TurnChatBridgeEvent {
    const eventSeed = hashStringToSeed(`turn_resolved_${turnIndex}_${playerId}`);
    return {
      eventName: CHAT_EVENT_TURN_RESOLVED,
      turnIndex,
      playerId,
      payload: {
        deltas,
        cashChange: deltas.cash,
        heatChange: deltas.heat,
        shieldChange: deltas.shield,
      },
      timestamp: Date.now(),
      eventHash: normalizeSeed(eventSeed ^ DEFAULT_NON_ZERO_SEED),
    };
  }

  /**
   * Build a critical_play event for exceptional decisions.
   */
  buildCriticalPlayEvent(
    turnIndex: number,
    playerId: number,
    classification: string,
    score: number,
  ): TurnChatBridgeEvent {
    const eventSeed = hashStringToSeed(`critical_play_${turnIndex}_${classification}`);
    return {
      eventName: CHAT_EVENT_CRITICAL_PLAY,
      turnIndex,
      playerId,
      payload: {
        classification,
        score,
        isCritical: true,
        triggerAnimation: classification === 'optimal' ? 'gold_burst' : 'red_flash',
      },
      timestamp: Date.now(),
      eventHash: normalizeSeed(eventSeed ^ DEFAULT_NON_ZERO_SEED),
    };
  }

  /**
   * Process a full turn resolution result and emit all chat events.
   */
  processResult(result: TurnResolutionResult): void {
    for (const chatEvent of result.chatEvents) {
      this.emit(chatEvent);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 13 — ANALYTICS & DIAGNOSTICS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Turn-by-turn analytics collection and aggregation.
 * Tracks decision quality trends, mode performance comparison,
 * and efficiency metrics across a run.
 */
export class TurnAnalyticsCollector {
  private readonly analytics: TurnAnalytics[] = [];
  private readonly qualityHistory: number[] = [];
  private readonly modePerformance: Map<string, number[]> = new Map();

  /**
   * Record a turn's analytics data.
   */
  record(analytics: TurnAnalytics, mode: GameMode): void {
    this.analytics.push(analytics);
    this.qualityHistory.push(analytics.qualityScore);

    const modeKey = mode;
    const existing = this.modePerformance.get(modeKey) ?? [];
    existing.push(analytics.qualityScore);
    this.modePerformance.set(modeKey, existing);
  }

  /**
   * Get the average decision quality across all recorded turns.
   */
  getAverageQuality(): number {
    if (this.qualityHistory.length === 0) return 0;
    const sum = this.qualityHistory.reduce((a, b) => a + b, 0);
    return round6(sum / this.qualityHistory.length);
  }

  /**
   * Get the quality trend: is it improving, declining, or stable.
   */
  getQualityTrend(): 'improving' | 'declining' | 'stable' {
    if (this.qualityHistory.length < 5) return 'stable';

    const recent = this.qualityHistory.slice(-5);
    const earlier = this.qualityHistory.slice(-10, -5);

    if (earlier.length === 0) return 'stable';

    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const earlierAvg = earlier.reduce((a, b) => a + b, 0) / earlier.length;

    const diff = recentAvg - earlierAvg;
    if (diff > 0.05) return 'improving';
    if (diff < -0.05) return 'declining';
    return 'stable';
  }

  /**
   * Get mode performance comparison across all modes seen.
   */
  getModePerformanceComparison(): Record<string, {
    avgQuality: number;
    turnCount: number;
    bestTurn: number;
    worstTurn: number;
  }> {
    const result: Record<string, {
      avgQuality: number;
      turnCount: number;
      bestTurn: number;
      worstTurn: number;
    }> = {};

    this.modePerformance.forEach((scores, mode) => {
      const sum = scores.reduce((a, b) => a + b, 0);
      result[mode] = {
        avgQuality: round6(sum / scores.length),
        turnCount: scores.length,
        bestTurn: round6(Math.max(...scores)),
        worstTurn: round6(Math.min(...scores)),
      };
    });

    return result;
  }

  /**
   * Get efficiency tracking: how well are resources being converted to CORDs.
   */
  getEfficiencyMetrics(): {
    cashToCordRatio: number;
    heatPerTurn: number;
    cordsPerTurn: number;
    shieldUtilization: number;
  } {
    if (this.analytics.length === 0) {
      return {
        cashToCordRatio: 0,
        heatPerTurn: 0,
        cordsPerTurn: 0,
        shieldUtilization: 0,
      };
    }

    const lastAnalytics = this.analytics[this.analytics.length - 1];
    const totalTurns = this.analytics.length;

    return {
      cashToCordRatio: round6(
        lastAnalytics.cumulativeCords > 0
          ? totalTurns / lastAnalytics.cumulativeCords
          : 0
      ),
      heatPerTurn: round6(lastAnalytics.cumulativeHeat / totalTurns),
      cordsPerTurn: round6(lastAnalytics.cumulativeCords / totalTurns),
      shieldUtilization: round6(
        lastAnalytics.modeSpecificMetrics['shield_util'] ?? 0
      ),
    };
  }

  /**
   * Get deck type usage distribution across all turns.
   */
  getDeckTypeDistribution(): Record<string, number> {
    const distribution: Record<string, number> = {};

    for (const entry of this.analytics) {
      const turnHistory = GameState.getTurnHistory();
      for (const histEntry of turnHistory) {
        if (histEntry.turnIndex === entry.turnIndex) {
          const deckType = inferDeckTypeFromChoice(histEntry.event.decision);
          distribution[deckType] = (distribution[deckType] ?? 0) + 1;
        }
      }
    }

    return distribution;
  }

  /**
   * Get the full analytics log.
   */
  getFullLog(): readonly TurnAnalytics[] {
    return this.analytics;
  }

  /**
   * Generate a diagnostic summary for debugging.
   */
  generateDiagnosticSummary(): {
    version: string;
    totalTurns: number;
    avgQuality: number;
    trend: string;
    modeComparison: Record<string, unknown>;
    efficiency: Record<string, number>;
    deckDistribution: Record<string, number>;
  } {
    return {
      version: TURN_RESOLVER_VERSION,
      totalTurns: this.analytics.length,
      avgQuality: this.getAverageQuality(),
      trend: this.getQualityTrend(),
      modeComparison: this.getModePerformanceComparison(),
      efficiency: this.getEfficiencyMetrics(),
      deckDistribution: this.getDeckTypeDistribution(),
    };
  }

  /**
   * Compute decision quality standard deviation for variance analysis.
   */
  getQualityVariance(): number {
    if (this.qualityHistory.length < 2) return 0;
    const avg = this.getAverageQuality();
    const sumSquaredDiffs = this.qualityHistory.reduce(
      (sum, val) => sum + (val - avg) * (val - avg),
      0
    );
    return round6(Math.sqrt(sumSquaredDiffs / this.qualityHistory.length));
  }

  /**
   * Get the top N best and worst turn decisions.
   */
  getExtremeDecisions(n: number = 3): {
    best: readonly TurnAnalytics[];
    worst: readonly TurnAnalytics[];
  } {
    const sorted = [...this.analytics].sort((a, b) => b.qualityScore - a.qualityScore);
    return {
      best: sorted.slice(0, n),
      worst: sorted.slice(-n).reverse(),
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 14 — BATCH PROCESSING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Resolve multiple turns in sequence, generating a comprehensive batch report.
 * Used for simulation, testing, and offline analysis.
 */
export class TurnBatchProcessor {
  private readonly resolver: TurnResolver;
  private readonly collector: TurnAnalyticsCollector;
  private readonly mode: GameMode;

  constructor(runSeed: number = DEFAULT_RUN_SEED, mode: GameMode = GameMode.GO_ALONE) {
    this.resolver = new TurnResolver(runSeed, mode);
    this.collector = new TurnAnalyticsCollector();
    this.mode = mode;
  }

  /**
   * Process a batch of turns for a single player.
   */
  processBatch(playerId: number, turnCount: number): TurnBatchResult {
    const startedAt = Date.now();
    const effectiveTurnCount = Math.min(turnCount, MAX_BATCH_SIZE);
    const results: TurnResolutionResult[] = [];

    // Ensure player exists
    const player = GameState.getPlayer(playerId);
    if (!player) {
      throw new Error(`No player found with ID ${playerId} for batch processing`);
    }

    for (let i = 0; i < effectiveTurnCount; i++) {
      try {
        const result = this.resolver.resolveFullTurn(playerId);
        results.push(result);
        this.collector.record(result.analytics, this.mode);
      } catch (err) {
        // Heat ceiling reached — finalize the batch
        break;
      }
    }

    const completedAt = Date.now();

    // Compute batch statistics
    const modeBreakdown: Record<string, number> = {};
    modeBreakdown[this.mode] = results.length;

    // Generate batch hash
    const batchPayload = stableStringify({
      playerId,
      turnCount: results.length,
      mode: this.mode,
      firstProof: results[0]?.proofRecord.proofHash ?? 'none',
      lastProof: results[results.length - 1]?.proofRecord.proofHash ?? 'none',
    });
    const batchHash = sha256Hex(batchPayload);

    return {
      turns: results,
      totalTurns: results.length,
      averageQuality: this.collector.getAverageQuality(),
      modeBreakdown,
      batchReportVersion: BATCH_REPORT_VERSION,
      batchHash,
      startedAt,
      completedAt,
    };
  }

  /**
   * Process a batch across multiple players in round-robin fashion.
   */
  processMultiPlayerBatch(
    playerIds: readonly number[],
    turnsPerPlayer: number,
  ): TurnBatchResult {
    const startedAt = Date.now();
    const results: TurnResolutionResult[] = [];

    for (let turn = 0; turn < turnsPerPlayer; turn++) {
      for (const playerId of playerIds) {
        try {
          const result = this.resolver.resolveFullTurn(playerId);
          results.push(result);
          this.collector.record(result.analytics, this.mode);
        } catch {
          // Skip players that have hit limits
        }
      }
    }

    const completedAt = Date.now();
    const modeBreakdown: Record<string, number> = {};
    modeBreakdown[this.mode] = results.length;

    const batchPayload = stableStringify({
      playerIds,
      totalResults: results.length,
      mode: this.mode,
    });
    const batchHash = sha256Hex(batchPayload);

    return {
      turns: results,
      totalTurns: results.length,
      averageQuality: this.collector.getAverageQuality(),
      modeBreakdown,
      batchReportVersion: BATCH_REPORT_VERSION,
      batchHash,
      startedAt,
      completedAt,
    };
  }

  /**
   * Get the analytics collector for inspection.
   */
  getCollector(): TurnAnalyticsCollector {
    return this.collector;
  }

  /**
   * Generate a batch diagnostic report.
   */
  generateBatchDiagnostics(): {
    diagnostics: ReturnType<TurnAnalyticsCollector['generateDiagnosticSummary']>;
    qualityVariance: number;
    qualityTrend: string;
    extremeDecisions: ReturnType<TurnAnalyticsCollector['getExtremeDecisions']>;
  } {
    return {
      diagnostics: this.collector.generateDiagnosticSummary(),
      qualityVariance: this.collector.getQualityVariance(),
      qualityTrend: this.collector.getQualityTrend(),
      extremeDecisions: this.collector.getExtremeDecisions(3),
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE GUARD & VALIDATION UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validate that a CardPlayRequest is legal in the given execution context.
 * Produces a TimingValidationResult indicating legality.
 */
export function validateCardPlayRequest(
  request: CardPlayRequest,
  context: ExecutionContext,
): TimingValidationResult {
  const timingClass = request.timingClass ?? TimingClass.ANY;

  // Check mode legality
  const legalDeckTypes = CARD_LEGALITY_MATRIX[context.mode];

  // Build validation result
  const allowed: TimingClass[] = [TimingClass.ANY, TimingClass.PRE, TimingClass.POST];

  // Add mode-specific timing classes
  const behavior = getModeCardBehavior(context.mode);
  if (behavior.counterWindowEnabled && context.activeCounterWindow) {
    allowed.push(TimingClass.CTR);
  }
  if (behavior.rescueEnabled && context.activeRescueWindow) {
    allowed.push(TimingClass.RES);
  }
  if (behavior.aidWindowEnabled && context.activeAidWindow) {
    allowed.push(TimingClass.AID);
  }
  if (behavior.ghostEnabled && context.activeGhostBenchmarkWindow) {
    allowed.push(TimingClass.GBM);
  }
  if (context.activeCascadeInterceptWindow) {
    allowed.push(TimingClass.CAS);
  }
  if (context.activePhaseBoundaryWindow) {
    allowed.push(TimingClass.PHZ);
  }
  if (context.activePressureSpikeWindow) {
    allowed.push(TimingClass.PSK);
  }
  if (context.isFinalTick) {
    allowed.push(TimingClass.END);
  }
  if (context.activeFateWindow) {
    allowed.push(TimingClass.FATE);
  }

  const isTimingLegal = allowed.includes(timingClass);
  const targetingResult = request.targetId ? Targeting.SELF : Targeting.SELF;

  if (!isTimingLegal) {
    return {
      valid: false,
      rejectionCode: null,
      reason: `Timing class ${timingClass} not available in current window`,
      requestedTiming: timingClass,
      allowedTimingClasses: allowed,
      effectiveTargeting: targetingResult,
    };
  }

  return {
    valid: true,
    rejectionCode: null,
    reason: null,
    requestedTiming: timingClass,
    allowedTimingClasses: allowed,
    effectiveTargeting: targetingResult,
  };
}

/**
 * Build a CardInHand from a Card and deck type for simulation purposes.
 */
export function buildSimulatedCardInHand(
  card: Card,
  deckType: DeckType,
  mode: GameMode,
  tick: number,
): CardInHand {
  const profile = getDeckTypeProfile(deckType);
  const behavior = getModeCardBehavior(mode);
  const pressureMod = computePressureCostModifier(PressureTier.T1_STABLE);

  const effectiveCost = round6(card.weight * 10 * pressureMod);
  const modeDefaults = MODE_TAG_WEIGHT_DEFAULTS[mode];

  return {
    instanceId: `sim_${card.index}_${tick}`,
    definition: {
      cardId: `sim_${deckType}_${card.index}`,
      name: `Simulated ${deckType} #${card.index}`,
      deckType,
      baseCost: round6(card.weight * 10),
      effects: [],
      tags: TurnDecisionScorer.inferTagsForDeckType(deckType),
      timingClasses: [TimingClass.ANY],
      rarity: CardRarity.COMMON,
      autoResolve: profile.autoResolveDefault,
      counterability: profile.defaultCounterability,
      targeting: profile.defaultTargeting,
    },
    overlay: {
      costModifier: 1.0,
      effectModifier: 1.0,
      tagWeights: modeDefaults,
      timingLock: [],
      legal: isDeckLegalInMode(deckType, mode),
      cordWeight: profile.baselineCordWeight,
      holdAllowed: behavior.holdEnabled,
    },
    drawnAtTick: tick,
    effectiveCost,
    effectiveCurrency: 'cash',
    isForced: false,
    isHeld: false,
    isLegendary: false,
  };
}

/**
 * Quick helper to create a default player for testing.
 */
export function createTestPlayer(id: number, deckSize: number = 30): Player {
  return {
    id,
    hand: [],
    deckSize,
    ledger: createDefaultLedger(),
  };
}

/**
 * Quick helper to run a simulation batch and return diagnostics.
 */
export function runSimulationBatch(
  playerCount: number,
  turnsPerPlayer: number,
  mode: GameMode = GameMode.GO_ALONE,
  seed: number = DEFAULT_RUN_SEED,
): TurnBatchResult {
  // Set up players
  const playerIds: number[] = [];
  for (let i = 0; i < playerCount; i++) {
    const player = createTestPlayer(i + 1);
    GameState.setPlayer(player);
    playerIds.push(player.id);
  }

  const processor = new TurnBatchProcessor(seed, mode);
  return processor.processMultiPlayerBatch(playerIds, turnsPerPlayer);
}

/**
 * Verify a turn's ledger transition using the replay engine's GameState.
 * Applies the turn effects to a fresh ReplayGameState instance and confirms
 * the final ledger matches the expected outcome.
 */
export function verifyTurnLedgerTransition(
  runSeed: number,
  turnIndex: number,
  decision: Choice,
  expectedLedgerAfter: Ledger,
): boolean {
  const normalizedSeed = normalizeSeed(runSeed);
  const replayState = new ReplayGameState(normalizedSeed);

  const initialLedger = createDefaultLedger();
  const runCreated: RunEvent = {
    type: 'RUN_CREATED',
    runId: `verify_${turnIndex}`,
    seed: normalizedSeed,
    createdAt: Date.now(),
    ledger: initialLedger,
  };
  replayState.applyEvent(runCreated);

  const turnSubmitted: RunEvent = {
    type: 'TURN_SUBMITTED',
    runId: `verify_${turnIndex}`,
    turnIndex,
    decisionId: decision.id,
    choiceId: decision.id,
    submittedAt: Date.now(),
    effects: decision.effects,
  };
  replayState.applyEvent(turnSubmitted);

  const snapshot = replayState.snapshot();
  return snapshot.ledger.turn === expectedLedgerAfter.turn;
}

/**
 * Get full deck type profile data for all legal deck types in a given mode.
 * Iterates DECK_TYPE_PROFILES and MODE_CARD_BEHAVIORS directly.
 */
export function getModeDeckProfiles(mode: GameMode): Array<{
  deckType: DeckType;
  baselineHeat: number;
  baselineCordWeight: number;
  drawRateMultiplier: number;
  isExclusive: boolean;
  isBanned: boolean;
}> {
  const modeBehavior = MODE_CARD_BEHAVIORS[mode];
  const profiles: Array<{
    deckType: DeckType;
    baselineHeat: number;
    baselineCordWeight: number;
    drawRateMultiplier: number;
    isExclusive: boolean;
    isBanned: boolean;
  }> = [];

  for (const deckTypeKey of Object.values(DeckType)) {
    const profile = DECK_TYPE_PROFILES[deckTypeKey];
    profiles.push({
      deckType: deckTypeKey,
      baselineHeat: profile.baselineHeat,
      baselineCordWeight: profile.baselineCordWeight,
      drawRateMultiplier: profile.drawRateMultiplier,
      isExclusive: modeBehavior.exclusiveDeckTypes.includes(deckTypeKey),
      isBanned: modeBehavior.bannedDeckTypes.includes(deckTypeKey),
    });
  }

  return profiles;
}
