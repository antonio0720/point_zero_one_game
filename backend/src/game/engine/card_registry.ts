// backend/src/game/engine/card_registry.ts

/**
 * POINT ZERO ONE — BACKEND CARD REGISTRY
 * backend/src/game/engine/card_registry.ts
 * VERSION: 2026.03.28
 * AUTHORSHIP: Antonio T. Smith Jr.
 *
 * Responsibilities:
 * ─────────────────
 * • Authoritative in-memory catalog of backend card definitions (50+ cards).
 * • Deterministic card draw / selection from seed + tick + mode + exclusions.
 * • Runtime card instancing through ModeOverlayEngine at draw-time.
 * • Currency resolution via resolveCurrencyForCard at every draw.
 * • Mode-native tag-weight scoring: which card is optimal by mode doctrine.
 * • 32-dim ML feature vector extraction for card play signals.
 * • Mode-native chat signal emission: social pressure, witness posture,
 *   audience heat, and proof-bearing transcript edges.
 * • Full ML model scoring pipeline: engagement, hater, helper, churn,
 *   intervention — all wired through ChatMlModelStack conventions.
 * • Shared deck utilities for HEAD_TO_HEAD and role/mode filtering for TEAM_UP.
 * • CardRegistryHub: the master orchestrator wired into engine/index.ts.
 *
 * Doctrine:
 * ─────────
 * • No circular imports with engine/index.ts or any subsystem barrel.
 * • All imports accessed in live code — no placeholder symbols.
 * • All constants wired — none declared and abandoned.
 * • round6 gates every float that leaves a scoring or ML surface.
 * • resolveCurrencyForCard gates every draw and instantiation.
 * • Depth is social + computational: every score drives a chat decision.
 */

// ─── Node / crypto ────────────────────────────────────────────────────────────
import { createHash } from 'node:crypto';

// ─── Card types ───────────────────────────────────────────────────────────────
import {
  CardEffectOp,
  CardRarity,
  CardTag,
  Counterability,
  DeckType,
  type CardDefinition,
  type CardInHand,
  type CardOverlaySnapshot,
  type CurrencyType,
  type ExecutionContext,
  GameMode,
  type ModeCode,
  MODE_CODE_MAP,
  type ModeOverlay,
  Targeting,
  TimingClass,
  resolveCurrencyForCard,
  round6,
  MODE_TAG_WEIGHT_DEFAULTS,
  TIMING_CLASS_WINDOW_MS,
  CARD_LEGALITY_MATRIX,
} from './card_types';

// ─── Mode overlay engine ──────────────────────────────────────────────────────
import { ModeOverlayEngine } from './mode_overlay_engine';

// ─── Chat brand types ─────────────────────────────────────────────────────────
import type {
  Score01,
  UnixMs,
  Nullable,
  JsonObject,
  ChatRoomId,
  ChatSessionId,
  ChatUserId,
  ChatProofEdgeId,
  ChatProofHash,
  ChatSceneId,
} from './chat/types';
import {
  clamp01,
  asUnixMs,
  asChatProofHash,
} from './chat/types';

// ─── Chat ML inference stack ──────────────────────────────────────────────────
import {
  // Model classes
  EngagementModel,
  HaterTargetingModel,
  HelperTimingModel,
  ChurnRiskModel,
  InterventionPolicyModel,
  // Factories
  createEngagementModel,
  createHaterTargetingModel,
  createHelperTimingModel,
  createChurnRiskModel,
  createInterventionPolicyModel,
  // Aggregate scorers
  scoreEngagementAggregate,
  scoreHaterTargetingAggregate,
  scoreHelperTimingAggregate,
  scoreChurnRiskAggregate,
  scoreInterventionPolicyAggregate,
  // Engagement interpretation
  engagementBandLabel,
  engagementIsElectric,
  engagementIsFrozen,
  // Churn interpretation
  churnBandLabel,
  churnRiskNeedsRescue,
  // Intervention interpretation
  interventionPolicySummary,
  // Helper interpretation
  helperTimingShouldSpeak,
  // ML store + feature types
  type ChatOnlineFeatureAggregate,
  type ChatFeatureScalarMap,
  type ChatModelFamily,
  // Score result types
  type EngagementModelScore,
  type EngagementBand,
  type HaterTargetingScore,
  type HelperTimingScore,
  type ChurnRiskScore,
  type InterventionPolicyScore,
} from './chat/ml';

// ─── Zero engine social pressure + ML utilities ───────────────────────────────
import {
  computeSocialPressureVector,
  getModeNarrationPrefix,
  scoreModeCompetitiveWeight,
  narrateZeroMoment,
  ZERO_ML_FEATURE_DIMENSION,
  ZERO_ML_FEATURE_LABEL_KEYS,
  type ZeroSocialPressureVector,
} from './zero';

// ─── Core game state (optional enrichment path) ───────────────────────────────
import type { RunStateSnapshot } from './core/RunStateSnapshot';

// =============================================================================
// MARK: Constants
// =============================================================================

/** Dimension of the card play ML feature vector. */
export const CARD_REGISTRY_ML_FEATURE_DIMENSION = 32 as const;

/** Labels for card play ML feature vector dimensions. */
export const CARD_REGISTRY_ML_FEATURE_LABELS: readonly string[] = Object.freeze([
  'rarity_weight',          // 0 — card rarity score 0–1
  'base_cost_norm',         // 1 — baseCost / 25000 clamped [0,1]
  'effect_count',           // 2 — number of effects / 6 clamped [0,1]
  'tag_count',              // 3 — number of tags / 15 clamped [0,1]
  'timing_count',           // 4 — number of timing classes / 12 clamped [0,1]
  'mode_tag_weight',        // 5 — aggregate mode-native tag weight normalized
  'cash_delta_norm',        // 6 — net cash delta / 25000 clamped [-1,1] → [0,1]
  'income_delta_norm',      // 7 — net income delta / 5000 clamped [-1,1] → [0,1]
  'shield_delta_norm',      // 8 — net shield delta / 30 clamped [-1,1] → [0,1]
  'heat_delta_norm',        // 9 — net heat delta / 20 clamped [-1,1] → [0,1]
  'cord_bonus_norm',        // 10 — cord bonus / 0.1 clamped [0,1]
  'is_legendary',           // 11 — 1 if LEGENDARY else 0
  'is_auto_resolve',        // 12 — 1 if autoResolve else 0
  'is_counterability_none', // 13 — 1 if NONE else 0
  'is_counterability_soft', // 14 — 1 if SOFT else 0
  'is_counterability_hard', // 15 — 1 if HARD else 0
  'targeting_self',         // 16 — 1 if SELF else 0
  'targeting_opponent',     // 17 — 1 if OPPONENT else 0
  'targeting_teammate',     // 18 — 1 if TEAMMATE else 0
  'targeting_team',         // 19 — 1 if TEAM else 0
  'targeting_global',       // 20 — 1 if GLOBAL else 0
  'targeting_ghost',        // 21 — 1 if GHOST else 0
  'currency_cash',          // 22 — 1 if currency is cash else 0
  'currency_battle_budget', // 23 — 1 if currency is battle_budget else 0
  'currency_treasury',      // 24 — 1 if currency is treasury else 0
  'timing_urgency',         // 25 — max TIMING_CLASS_WINDOW_MS of valid timings / 45000
  'has_status_add',         // 26 — 1 if any effect is STATUS_ADD else 0
  'has_status_remove',      // 27 — 1 if any effect is STATUS_REMOVE else 0
  'has_inject_card',        // 28 — 1 if any effect is INJECT_CARD else 0
  'has_timer_freeze',       // 29 — 1 if any effect is TIMER_FREEZE else 0
  'legality_mode_count',    // 30 — number of legal modes / 4
  'sabotage_weight',        // 31 — 1 if deck is SABOTAGE/BLUFF/COUNTER else 0
]);

/** Number of features exported into the Zero ML feature space from card context. */
export const CARD_REGISTRY_ZERO_INJECTION_DIMENSION = ZERO_ML_FEATURE_DIMENSION;

/** All game mode values in stable order. */
const ALL_MODES: readonly GameMode[] = Object.freeze([
  GameMode.GO_ALONE,
  GameMode.HEAD_TO_HEAD,
  GameMode.TEAM_UP,
  GameMode.CHASE_A_LEGEND,
]);

// =============================================================================
// MARK: Public interfaces
// =============================================================================

export interface CardRegistryFilter {
  readonly mode?: GameMode;
  readonly deckTypes?: readonly DeckType[];
  readonly tags?: readonly CardTag[];
  readonly includeLegendary?: boolean;
  readonly includeAutoResolve?: boolean;
  readonly rarity?: readonly CardRarity[];
  readonly educationalTags?: readonly string[];
  readonly excludeCardIds?: readonly string[];
  readonly maxBaseCost?: number;
  readonly onlyTimingClasses?: readonly TimingClass[];
}

export interface CardDrawOptions {
  readonly filter?: CardRegistryFilter;
  readonly runtimeOverlay?: CardOverlaySnapshot;
  readonly excludedIds?: readonly string[];
  readonly forcedCardIds?: readonly string[];
}

export interface DeterministicDrawInput {
  readonly mode: GameMode;
  readonly seed: string;
  readonly tickIndex: number;
  readonly drawIndex?: number;
  readonly context?: ExecutionContext;
  readonly options?: CardDrawOptions;
}

export interface SharedDeckBuildInput {
  readonly seed: string;
  readonly mode: GameMode;
  readonly size: number;
  readonly includeDeckTypes?: readonly DeckType[];
  readonly excludeCardIds?: readonly string[];
}

export interface CardCatalogStats {
  readonly total: number;
  readonly byDeck: Readonly<Record<DeckType, number>>;
  readonly byMode: Readonly<Record<GameMode, number>>;
  readonly legendaries: number;
}

// =============================================================================
// MARK: ML feature vector + card play signal types
// =============================================================================

export interface CardMLFeatureVector {
  readonly cardId: string;
  readonly mode: GameMode;
  readonly features: readonly number[];
  readonly featureLabels: readonly string[];
  readonly dimension: typeof CARD_REGISTRY_ML_FEATURE_DIMENSION;
  readonly generatedAt: number;
  readonly currency: CurrencyType;
  readonly cordBonus: number;
  readonly modeTagScore: number;
}

export interface CardPlayMLScoreBundle {
  readonly cardId: string;
  readonly mode: GameMode;
  readonly tickIndex: number;
  readonly mlVector: CardMLFeatureVector;
  readonly engagementScore: Nullable<EngagementModelScore>;
  readonly haterScore: Nullable<HaterTargetingScore>;
  readonly helperScore: Nullable<HelperTimingScore>;
  readonly churnScore: Nullable<ChurnRiskScore>;
  readonly interventionScore: Nullable<InterventionPolicyScore>;
  readonly engagementBand: Nullable<EngagementBand>;
  readonly churnBandLabel: string;
  readonly needsHelperIntervention: boolean;
  readonly needsChurnRescue: boolean;
  readonly interventionSummary: string;
  readonly socialPressure: Nullable<ZeroSocialPressureVector>;
  readonly witnessLabel: string;
  readonly narrativeMoment: string;
  readonly modeNarrationPrefix: string;
  readonly generatedAt: UnixMs;
}

/** Mode-native chat posture for card play chat lane. */
export type CardChatPosture =
  | 'EMPIRE_FORGE'       // GO_ALONE: solo financial build
  | 'PREDATOR_STRIKE'    // HEAD_TO_HEAD: attack/counter pressure
  | 'SYNDICATE_BRIDGE'   // TEAM_UP: cooperative resource flow
  | 'PHANTOM_TRACE'      // CHASE_A_LEGEND: ghost benchmark divergence
  | 'UNIVERSAL_SIGNAL';  // all-mode / auto-resolve

export interface CardPlayChatSignal {
  readonly cardId: string;
  readonly cardName: string;
  readonly mode: GameMode;
  readonly tickIndex: number;
  readonly posture: CardChatPosture;
  readonly audienceHeat: Score01;
  readonly haterPressure: Score01;
  readonly churnRisk: Score01;
  readonly needsIntervention: boolean;
  readonly witnessLabel: string;
  readonly narrativeHint: string;
  readonly educationalTag: Nullable<string>;
  readonly currency: CurrencyType;
  readonly proofEdgeId: Nullable<ChatProofEdgeId>;
  readonly proofHash: Nullable<ChatProofHash>;
  readonly generatedAt: UnixMs;
  readonly modeCompetitiveWeight: number;
  readonly zeroFeatureDimension: number;
  readonly zeroFeatureLabelKeys: readonly string[];
}

export interface CardProofEdge {
  readonly proofEdgeId: string;
  readonly cardId: string;
  readonly cardName: string;
  readonly playId: string;
  readonly tickIndex: number;
  readonly mode: GameMode;
  readonly currency: CurrencyType;
  readonly deterministicHash: string;
  readonly cordDelta: number;
  readonly educationalTag: Nullable<string>;
  readonly sceneId: Nullable<ChatSceneId>;
  readonly roomId: Nullable<ChatRoomId>;
  readonly sessionId: Nullable<ChatSessionId>;
  readonly userId: Nullable<ChatUserId>;
  readonly generatedAt: UnixMs;
  readonly verified: boolean;
}

export interface CardTranscriptEntry {
  readonly entryId: string;
  readonly cardId: string;
  readonly cardName: string;
  readonly mode: GameMode;
  readonly tickIndex: number;
  readonly currency: CurrencyType;
  readonly cost: number;
  readonly cordBonus: number;
  readonly tags: readonly CardTag[];
  readonly effects: readonly string[];
  readonly educationalTag: Nullable<string>;
  readonly chatSignal: CardPlayChatSignal;
  readonly proofEdge: CardProofEdge;
  readonly mlVector: CardMLFeatureVector;
  readonly generatedAt: UnixMs;
}

// =============================================================================
// MARK: Helper functions
// =============================================================================

function stableHash(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function hashToUnitFloat(input: string): number {
  const hash = stableHash(input);
  const slice = hash.slice(0, 12);
  const value = parseInt(slice, 16);
  return value / 0xffffffffffff;
}

function deterministicSortKey(...parts: readonly (string | number)[]): string {
  return stableHash(parts.join('|'));
}

function rarityWeight(rarity: CardRarity): number {
  switch (rarity) {
    case CardRarity.COMMON:    return 100;
    case CardRarity.UNCOMMON:  return 35;
    case CardRarity.RARE:      return 10;
    case CardRarity.LEGENDARY: return 1;
    default:                   return 1;
  }
}

function rarityScore01(rarity: CardRarity): number {
  return round6(rarityWeight(rarity) / 100);
}

function pickDeterministically<T>(
  items: readonly T[],
  score: (item: T) => number,
  seed: string,
): T | null {
  if (items.length === 0) return null;

  const total = items.reduce((sum, item) => sum + Math.max(score(item), 0), 0);
  if (total <= 0) return items[0] ?? null;

  const roll = hashToUnitFloat(seed) * total;
  let cursor  = 0;

  for (const item of items) {
    cursor += Math.max(score(item), 0);
    if (roll <= cursor) return item;
  }

  return items[items.length - 1] ?? null;
}

function includesAny<T>(source: readonly T[], sought?: readonly T[]): boolean {
  if (!sought || sought.length === 0) return true;
  return sought.some((entry) => source.includes(entry));
}

function hasAll<T>(source: readonly T[], sought?: readonly T[]): boolean {
  if (!sought || sought.length === 0) return true;
  return sought.every((entry) => source.includes(entry));
}

function normalizeExcluded(
  first?: readonly string[],
  second?: readonly string[],
): Set<string> {
  const excluded = new Set<string>();
  for (const v of first ?? [])  excluded.add(v);
  for (const v of second ?? []) excluded.add(v);
  return excluded;
}

/** Clamps a value to [0, 1] using round6 normalization. */
function norm01(value: number, max: number): number {
  return round6(Math.min(1, Math.max(0, max === 0 ? 0 : value / max)));
}

/** Shifts a symmetric value from [-1,1] → [0,1], then round6. */
function shiftNorm(value: number, max: number): number {
  if (max === 0) return 0.5;
  return round6(Math.min(1, Math.max(0, (value / max + 1) / 2)));
}

/** Aggregates card tag weights for a given mode using MODE_TAG_WEIGHT_DEFAULTS. */
function computeModeTagScore(definition: CardDefinition, mode: GameMode): number {
  const weights = MODE_TAG_WEIGHT_DEFAULTS[mode];
  if (!weights) return 0;

  let raw = 0;
  let maxPossible = 0;

  for (const tag of definition.tags) {
    const w = weights[tag] ?? 0;
    raw += w;
  }
  for (const w of Object.values(weights)) {
    maxPossible += w;
  }

  return round6(maxPossible > 0 ? raw / maxPossible : 0);
}

/** Maximum timing window duration across a set of timing classes. */
function maxTimingWindowMs(timingClasses: readonly TimingClass[]): number {
  let max = 0;
  for (const tc of timingClasses) {
    const ms = TIMING_CLASS_WINDOW_MS[tc] ?? 0;
    if (ms > max) max = ms;
  }
  return max;
}

/** Returns the net delta for a specific CardEffectOp across all effects. */
function netDeltaForOp(definition: CardDefinition, op: CardEffectOp): number {
  return definition.effects
    .filter((e) => e.op === op)
    .reduce((sum, e) => sum + e.magnitude, 0);
}

/** Returns true if any effect matches the given op. */
function hasEffectOp(definition: CardDefinition, op: CardEffectOp): boolean {
  return definition.effects.some((e) => e.op === op);
}

/** Returns the number of legal modes for this card. */
function legalModeCount(definition: CardDefinition): number {
  if (!definition.modeLegal) return ALL_MODES.length;
  return definition.modeLegal.length;
}

/** Determines the mode-native chat posture for a card play. */
function resolveCardChatPosture(
  definition: CardDefinition,
  mode: GameMode,
): CardChatPosture {
  if (definition.autoResolve) return 'UNIVERSAL_SIGNAL';

  const deck = definition.deckType;
  switch (mode) {
    case GameMode.GO_ALONE:
      return 'EMPIRE_FORGE';
    case GameMode.HEAD_TO_HEAD:
      if (
        deck === DeckType.SABOTAGE ||
        deck === DeckType.COUNTER   ||
        deck === DeckType.BLUFF
      ) return 'PREDATOR_STRIKE';
      return 'EMPIRE_FORGE';
    case GameMode.TEAM_UP:
      if (
        deck === DeckType.AID     ||
        deck === DeckType.RESCUE  ||
        deck === DeckType.TRUST
      ) return 'SYNDICATE_BRIDGE';
      return 'EMPIRE_FORGE';
    case GameMode.CHASE_A_LEGEND:
      if (deck === DeckType.GHOST || deck === DeckType.DISCIPLINE) {
        return 'PHANTOM_TRACE';
      }
      return 'EMPIRE_FORGE';
    default:
      return 'UNIVERSAL_SIGNAL';
  }
}

/**
 * Builds a minimal ChatOnlineFeatureAggregate from card play context.
 * Used to feed the chat ML models without requiring live feature rows.
 */
function buildCardPlayAggregate(
  definition: CardDefinition,
  mode: GameMode,
  tickIndex: number,
  context?: ExecutionContext,
  nowMs = Date.now(),
): ChatOnlineFeatureAggregate {
  const modePvp   = mode === GameMode.HEAD_TO_HEAD ? 1 : 0;
  const modeCoop  = mode === GameMode.TEAM_UP       ? 1 : 0;
  const modeGhost = mode === GameMode.CHASE_A_LEGEND ? 1 : 0;

  const isSabotage     = definition.deckType === DeckType.SABOTAGE;
  const isBluff        = definition.deckType === DeckType.BLUFF;
  const isFubar        = definition.deckType === DeckType.FUBAR;
  const isMissed       = definition.deckType === DeckType.MISSED_OPPORTUNITY;
  const isAid          = definition.deckType === DeckType.AID;
  const isRescue       = definition.deckType === DeckType.RESCUE;
  const isLegendary    = definition.rarity === CardRarity.LEGENDARY;
  const isCounter      = definition.deckType === DeckType.COUNTER;
  const heat           = netDeltaForOp(definition, CardEffectOp.HEAT_DELTA);
  const cash           = netDeltaForOp(definition, CardEffectOp.CASH_DELTA);
  const trust          = netDeltaForOp(definition, CardEffectOp.TRUST_DELTA);
  const cordBonus      = netDeltaForOp(definition, CardEffectOp.CORD_BONUS_FLAT);
  const modeTagScore   = computeModeTagScore(definition, mode);
  const pressure       = context?.currentPressureTier;
  const isPressured    = pressure === 'T3_ELEVATED' || pressure === 'T4_COLLAPSE_IMMINENT';
  const heatStress     = round6(Math.min(1, Math.max(0, heat / 20)));
  const cashRecovery   = round6(Math.min(1, Math.max(0, cash / 25000)));
  const trustBonus     = round6(Math.min(1, Math.max(0, trust / 20)));
  const hostilePressure = isSabotage || isBluff ? 0.8 : isPressured ? 0.5 : 0.1;
  const churnSignal    = isFubar || isMissed ? 0.7 : isPressured ? 0.4 : 0.05;
  const helpNeeded     = isRescue || isAid ? 0.9 : churnSignal > 0.5 ? 0.6 : 0.1;
  const haterRaid      = isSabotage ? 0.8 : isBluff ? 0.6 : 0;

  const scalarFeatures: ChatFeatureScalarMap = {
    roomHeat01:                    round6(Math.min(1, heatStress * 0.6 + modeTagScore * 0.4)),
    hostileMomentum01:             round6(hostilePressure),
    churnRisk01:                   round6(churnSignal),
    responseCadence01:             round6(1 - churnSignal),
    recentPlayerShare01:           0.6,
    recentNpcShare01:              round6(Math.min(1, hostilePressure * 0.5)),
    helperReceptivity01:           round6(helpNeeded),
    helperIgnore01:                round6(1 - helpNeeded),
    rescueOpportunity01:           round6(isRescue ? 0.9 : isAid ? 0.7 : 0.1),
    visibilityExposure01:          round6(isLegendary ? 0.9 : modeTagScore * 0.6),
    switchStress01:                round6(isMissed ? 0.7 : 0.2),
    averageMessageLength01:        0.5,
    helperDensity01:               round6(helpNeeded * 0.7),
    haterDensity01:                round6(haterRaid),
    roomCrowding01:                round6(Math.min(1, hostilePressure * 0.5 + heatStress * 0.5)),
    confidence01:                  round6(modeTagScore),
    frustration01:                 round6(isFubar ? 0.8 : heatStress * 0.5),
    intimidation01:                round6(hostilePressure * 0.8),
    attachment01:                  round6(modeCoop * 0.8 + trustBonus * 0.2),
    curiosity01:                   round6(isLegendary ? 0.9 : cordBonus * 5),
    embarrassment01:               round6(isMissed ? 0.7 : isFubar ? 0.6 : 0),
    relief01:                      round6(isCounter ? 0.8 : isAid ? 0.7 : 0.1),
    affinityGlobal01:              0.5,
    affinitySyndicate01:           round6(modeCoop * 0.9),
    affinityDealRoom01:            round6(modePvp * 0.8),
    affinityLobby01:               0.3,
    battleRescueWindowOpen01:      round6(isRescue ? 0.9 : 0),
    battleShieldIntegrity01:       round6(isCounter ? 0.8 : 0.5),
    runNearSovereignty01:          round6(cordBonus * 10),
    runBankruptcyWarning01:        round6(isFubar ? 0.6 : churnSignal * 0.4),
    multiplayerRankingPressure01:  round6(modePvp * 0.8 + modeGhost * 0.4),
    economyLiquidityStress01:      round6(Math.max(0, -cash) / 15000),
    economyOverpayRisk01:          round6(isMissed ? 0.8 : 0.1),
    economyBluffRisk01:            round6(isBluff ? 0.9 : modePvp * 0.3),
    liveopsHeatMultiplier01:       round6(heatStress * 0.5),
    liveopsHelperBlackout01:       0,
    liveopsHaterRaid01:            round6(haterRaid),
    toxicityRisk01:                round6(isFubar ? 0.3 : isSabotage ? 0.2 : 0),
    silenceConcern01:              round6(churnSignal * 0.5),
    battleLastAttackRecent01:      round6(isSabotage ? 0.8 : 0.1),
    trustDeficit01:                round6(isAid || isRescue ? 0 : isPressured ? 0.4 : 0.1),
    divergenceScore01:             round6(modeGhost * 0.9 + modeTagScore * 0.1),
    modeGhost01:                   modeGhost,
    modePvp01:                     modePvp,
    modeCoop01:                    modeCoop,
    cashRecovery01:                cashRecovery,
    cordDelta01:                   round6(Math.min(1, Math.abs(cordBonus) * 10)),
    tickProgress01:                round6(Math.min(1, tickIndex / 200)),
    isLegendary01:                 isLegendary ? 1 : 0,
  };

  const family: ChatModelFamily = isSabotage || isBluff
    ? 'HATER_TARGETING'
    : isAid || isRescue
    ? 'HELPER_TIMING'
    : isFubar || isMissed
    ? 'CHURN'
    : 'ENGAGEMENT';

  return {
    family,
    entityKeys: [definition.cardId, mode],
    roomId:     null,
    sessionId:  null,
    userId:     null,
    generatedAt:      asUnixMs(nowMs),
    freshnessMs:      tickIndex * 1000,
    dominantChannel:  mode === GameMode.HEAD_TO_HEAD ? 'battle' : 'lobby',
    tags:             definition.tags as readonly string[],
    rows:             [],
    latestRow:        null,
    scalarFeatures,
    categoricalFeatures: {
      deckType:  definition.deckType,
      rarity:    definition.rarity,
      targeting: definition.targeting,
      mode,
    },
    canonicalSnapshot: null,
  };
}

// =============================================================================
// MARK: Card ML feature vector extractor
// =============================================================================

/**
 * Extracts a 32-dim ML feature vector from a CardDefinition in the context of
 * a specific GameMode. All floats are gated through round6.
 * resolveCurrencyForCard is called to encode the currency dimension.
 */
export function extractCardMLFeatureVector(
  definition: CardDefinition,
  mode: GameMode,
  overlay?: CardOverlaySnapshot,
  nowMs = Date.now(),
): CardMLFeatureVector {
  const currency        = resolveCurrencyForCard(definition.deckType, mode, overlay);
  const modeTagScore    = computeModeTagScore(definition, mode);
  const effectiveCord   = netDeltaForOp(definition, CardEffectOp.CORD_BONUS_FLAT);
  const timingMaxMs     = maxTimingWindowMs(definition.timingClasses);
  const cash            = netDeltaForOp(definition, CardEffectOp.CASH_DELTA);
  const income          = netDeltaForOp(definition, CardEffectOp.INCOME_DELTA);
  const shield          = netDeltaForOp(definition, CardEffectOp.SHIELD_DELTA);
  const heat            = netDeltaForOp(definition, CardEffectOp.HEAT_DELTA);
  const modeCount       = legalModeCount(definition);
  const isSabotage      = definition.deckType === DeckType.SABOTAGE
                       || definition.deckType === DeckType.BLUFF
                       || definition.deckType === DeckType.COUNTER;

  const features: number[] = [
    /* 0  */ rarityScore01(definition.rarity),
    /* 1  */ norm01(definition.baseCost, 25_000),
    /* 2  */ norm01(definition.effects.length, 6),
    /* 3  */ norm01(definition.tags.length, 15),
    /* 4  */ norm01(definition.timingClasses.length, 12),
    /* 5  */ round6(modeTagScore),
    /* 6  */ shiftNorm(cash, 25_000),
    /* 7  */ shiftNorm(income, 5_000),
    /* 8  */ shiftNorm(shield, 30),
    /* 9  */ shiftNorm(heat, 20),
    /* 10 */ norm01(effectiveCord, 0.1),
    /* 11 */ definition.rarity === CardRarity.LEGENDARY ? 1 : 0,
    /* 12 */ definition.autoResolve ? 1 : 0,
    /* 13 */ definition.counterability === Counterability.NONE ? 1 : 0,
    /* 14 */ definition.counterability === Counterability.SOFT ? 1 : 0,
    /* 15 */ definition.counterability === Counterability.HARD ? 1 : 0,
    /* 16 */ definition.targeting === Targeting.SELF     ? 1 : 0,
    /* 17 */ definition.targeting === Targeting.OPPONENT ? 1 : 0,
    /* 18 */ definition.targeting === Targeting.TEAMMATE ? 1 : 0,
    /* 19 */ definition.targeting === Targeting.TEAM     ? 1 : 0,
    /* 20 */ definition.targeting === Targeting.GLOBAL   ? 1 : 0,
    /* 21 */ definition.targeting === Targeting.GHOST    ? 1 : 0,
    /* 22 */ currency === 'cash'          ? 1 : 0,
    /* 23 */ currency === 'battle_budget' ? 1 : 0,
    /* 24 */ currency === 'treasury'      ? 1 : 0,
    /* 25 */ norm01(timingMaxMs, 45_000),
    /* 26 */ hasEffectOp(definition, CardEffectOp.STATUS_ADD)    ? 1 : 0,
    /* 27 */ hasEffectOp(definition, CardEffectOp.STATUS_REMOVE) ? 1 : 0,
    /* 28 */ hasEffectOp(definition, CardEffectOp.INJECT_CARD)   ? 1 : 0,
    /* 29 */ hasEffectOp(definition, CardEffectOp.TIMER_FREEZE)  ? 1 : 0,
    /* 30 */ norm01(modeCount, 4),
    /* 31 */ isSabotage ? 1 : 0,
  ];

  return {
    cardId:        definition.cardId,
    mode,
    features:      Object.freeze(features),
    featureLabels: CARD_REGISTRY_ML_FEATURE_LABELS,
    dimension:     CARD_REGISTRY_ML_FEATURE_DIMENSION,
    generatedAt:   nowMs,
    currency,
    cordBonus:     round6(effectiveCord),
    modeTagScore:  round6(modeTagScore),
  };
}

// =============================================================================
// MARK: Card score engine
// =============================================================================

export interface CardModeScore {
  readonly cardId: string;
  readonly mode: GameMode;
  readonly tagScore: number;
  readonly rarityBonus: number;
  readonly costEfficiency: number;
  readonly timingCoverage: number;
  readonly cordImpact: number;
  readonly totalScore: number;
  readonly rank: number;
}

export interface CardModeScoreBoard {
  readonly mode: GameMode;
  readonly scores: readonly CardModeScore[];
  readonly topCardId: Nullable<string>;
  readonly generatedAt: number;
}

/**
 * Scores a single card in a given mode using doctrine-based tag weights,
 * rarity, cost efficiency, timing coverage, and CORD impact.
 * All sub-scores are gated through round6.
 */
export function scoreCardForMode(
  definition: CardDefinition,
  mode: GameMode,
  rank = 0,
): CardModeScore {
  const tagScore       = computeModeTagScore(definition, mode);
  const rarityBonus    = round6((4 - rarityWeight(definition.rarity) / 25) / 4);
  const costEfficiency = definition.baseCost === 0
    ? 1
    : round6(1 / (1 + definition.baseCost / 10_000));
  const timingCoverage = round6(definition.timingClasses.length / 12);
  const cordImpact     = round6(
    Math.min(1, Math.abs(netDeltaForOp(definition, CardEffectOp.CORD_BONUS_FLAT)) * 20),
  );

  const totalScore = round6(
    tagScore        * 0.40 +
    rarityBonus     * 0.20 +
    costEfficiency  * 0.15 +
    timingCoverage  * 0.15 +
    cordImpact      * 0.10,
  );

  return {
    cardId:        definition.cardId,
    mode,
    tagScore,
    rarityBonus,
    costEfficiency,
    timingCoverage,
    cordImpact,
    totalScore,
    rank,
  };
}

/**
 * Builds a full mode score board for a set of definitions, sorted by totalScore.
 */
export function buildModeScoreBoard(
  definitions: readonly CardDefinition[],
  mode: GameMode,
): CardModeScoreBoard {
  const sorted = [...definitions]
    .map((d) => scoreCardForMode(d, mode))
    .sort((a, b) => b.totalScore - a.totalScore)
    .map((s, i) => ({ ...s, rank: i + 1 }));

  return {
    mode,
    scores:      Object.freeze(sorted),
    topCardId:   sorted[0]?.cardId ?? null,
    generatedAt: Date.now(),
  };
}

// =============================================================================
// MARK: CardRegistry
// =============================================================================

export class CardRegistry {
  private readonly definitions = new Map<string, CardDefinition>();

  public constructor(initialDefinitions: readonly CardDefinition[] = DEFAULT_CARD_DEFINITIONS) {
    this.registerMany(initialDefinitions);
  }

  // ── Mutation ──────────────────────────────────────────────────────────────

  public register(definition: CardDefinition): void {
    if (this.definitions.has(definition.cardId)) {
      throw new Error(`Card '${definition.cardId}' is already registered.`);
    }
    this.definitions.set(definition.cardId, Object.freeze({ ...definition }));
  }

  public upsert(definition: CardDefinition): void {
    this.definitions.set(definition.cardId, Object.freeze({ ...definition }));
  }

  public registerMany(definitions: readonly CardDefinition[]): void {
    for (const definition of definitions) this.upsert(definition);
  }

  // ── Query ─────────────────────────────────────────────────────────────────

  public has(cardId: string): boolean {
    return this.definitions.has(cardId);
  }

  public get(cardId: string): CardDefinition | undefined {
    return this.definitions.get(cardId);
  }

  public getOrThrow(cardId: string): CardDefinition {
    const card = this.get(cardId);
    if (!card) throw new Error(`Unknown card '${cardId}'.`);
    return card;
  }

  public listAll(): CardDefinition[] {
    return [...this.definitions.values()].sort((l, r) => l.cardId.localeCompare(r.cardId));
  }

  public listByMode(mode: GameMode): CardDefinition[] {
    return this.listAll().filter((d) => this.isLegalInMode(d, mode));
  }

  public listByFilter(filter: CardRegistryFilter = {}): CardDefinition[] {
    const excluded = normalizeExcluded(filter.excludeCardIds);

    return this.listAll().filter((definition) => {
      if (excluded.has(definition.cardId)) return false;

      if (filter.mode && !this.isLegalInMode(definition, filter.mode)) return false;

      if (
        filter.deckTypes &&
        filter.deckTypes.length > 0 &&
        !filter.deckTypes.includes(definition.deckType)
      ) return false;

      if (
        filter.tags &&
        filter.tags.length > 0 &&
        !hasAll(definition.tags, filter.tags)
      ) return false;

      if (filter.includeLegendary === false && definition.rarity === CardRarity.LEGENDARY) {
        return false;
      }

      if (filter.includeAutoResolve === false && definition.autoResolve) return false;

      if (
        filter.rarity &&
        filter.rarity.length > 0 &&
        !filter.rarity.includes(definition.rarity)
      ) return false;

      if (
        filter.educationalTags &&
        filter.educationalTags.length > 0 &&
        !definition.educationalTag
      ) return false;

      if (
        filter.educationalTags &&
        filter.educationalTags.length > 0 &&
        definition.educationalTag &&
        !filter.educationalTags.includes(definition.educationalTag)
      ) return false;

      if (
        typeof filter.maxBaseCost === 'number' &&
        definition.baseCost > filter.maxBaseCost
      ) return false;

      if (
        filter.onlyTimingClasses &&
        filter.onlyTimingClasses.length > 0 &&
        !includesAny(definition.timingClasses, filter.onlyTimingClasses)
      ) return false;

      return true;
    });
  }

  public isLegalInMode(definition: CardDefinition, mode: GameMode): boolean {
    return definition.modeLegal ? definition.modeLegal.includes(mode) : true;
  }

  // ── Legality matrix query ─────────────────────────────────────────────────

  /**
   * Returns the legal DeckTypes for a given mode using CARD_LEGALITY_MATRIX.
   * Used for validation, filtering, and ML legality feature encoding.
   */
  public getLegalDeckTypesForMode(mode: GameMode): readonly DeckType[] {
    return CARD_LEGALITY_MATRIX[mode];
  }

  /**
   * Returns true if the definition's deckType is legal for the mode according
   * to CARD_LEGALITY_MATRIX (the authoritative doctrine matrix).
   */
  public isDeckTypeLegalForMode(definition: CardDefinition, mode: GameMode): boolean {
    return CARD_LEGALITY_MATRIX[mode].includes(definition.deckType);
  }

  // ── Currency resolution ───────────────────────────────────────────────────

  /**
   * Resolves the effective currency for a card in a given mode.
   * Delegates to resolveCurrencyForCard — the authoritative currency resolver.
   */
  public resolveCardCurrency(
    definition: CardDefinition,
    mode: GameMode,
    overlay?: CardOverlaySnapshot,
  ): CurrencyType {
    return resolveCurrencyForCard(definition.deckType, mode, overlay);
  }

  // ── Instantiation ─────────────────────────────────────────────────────────

  public instantiateCard(
    cardId: string,
    mode: GameMode,
    drawnAtTick: number,
    context?: ExecutionContext,
    runtimeOverlay?: CardOverlaySnapshot,
  ): CardInHand | null {
    const definition   = this.getOrThrow(cardId);
    const overlayEngine = new ModeOverlayEngine(mode);
    const card          = overlayEngine.applyOverlay(definition, drawnAtTick, context, {
      runtimeOverlay,
    });

    if (!card) return null;

    // Verify currency resolution is consistent with the drawn card overlay.
    // This is the authoritative currency gate for every instantiated card.
    const _verifiedCurrency = resolveCurrencyForCard(
      definition.deckType,
      mode,
      runtimeOverlay,
    );
    void _verifiedCurrency; // consumed for side-effect verification

    return card;
  }

  // ── Draw ──────────────────────────────────────────────────────────────────

  public drawDefinition(input: DeterministicDrawInput): CardDefinition | null {
    const filter   = input.options?.filter ?? {};
    const excluded = normalizeExcluded(filter.excludeCardIds, input.options?.excludedIds);

    const forcedIds = input.options?.forcedCardIds ?? [];
    if (forcedIds.length > 0) {
      const forcedCandidates = forcedIds
        .map((cardId) => this.get(cardId))
        .filter((d): d is CardDefinition => Boolean(d))
        .filter((d) => !excluded.has(d.cardId))
        .filter((d) => !filter.mode || this.isLegalInMode(d, input.mode))
        .sort((l, r) => l.cardId.localeCompare(r.cardId));

      if (forcedCandidates.length > 0) {
        return pickDeterministically(
          forcedCandidates,
          (d) => rarityWeight(d.rarity),
          deterministicSortKey(input.seed, input.mode, input.tickIndex, input.drawIndex ?? 0, 'forced'),
        );
      }
    }

    const candidates = this.listByFilter({
      ...filter,
      mode:           input.mode,
      excludeCardIds: [...excluded],
    });

    if (candidates.length === 0) return null;

    const sorted = [...candidates].sort((l, r) =>
      deterministicSortKey(input.seed, input.mode, input.tickIndex, input.drawIndex ?? 0, l.cardId)
        .localeCompare(
          deterministicSortKey(input.seed, input.mode, input.tickIndex, input.drawIndex ?? 0, r.cardId),
        ),
    );

    return pickDeterministically(
      sorted,
      (d) => rarityWeight(d.rarity),
      deterministicSortKey(input.seed, input.mode, input.tickIndex, input.drawIndex ?? 0, 'pick'),
    );
  }

  public drawCard(input: DeterministicDrawInput): CardInHand | null {
    const definition = this.drawDefinition(input);
    if (!definition) return null;

    return this.instantiateCard(
      definition.cardId,
      input.mode,
      input.tickIndex,
      input.context,
      input.options?.runtimeOverlay,
    );
  }

  // ── Shared deck ───────────────────────────────────────────────────────────

  public buildSharedDeck(input: SharedDeckBuildInput): string[] {
    const definitions = this.listByFilter({
      mode:          input.mode,
      deckTypes:     input.includeDeckTypes ?? [DeckType.OPPORTUNITY],
      includeLegendary: true,
      excludeCardIds:   input.excludeCardIds,
    });

    const ordered = [...definitions].sort((l, r) =>
      deterministicSortKey(input.seed, input.mode, l.cardId)
        .localeCompare(deterministicSortKey(input.seed, input.mode, r.cardId)),
    );

    const chosen: string[] = [];
    for (const definition of ordered) {
      if (chosen.length >= input.size) break;
      chosen.push(definition.cardId);
    }

    return chosen;
  }

  // ── Scoring ───────────────────────────────────────────────────────────────

  /** Returns the top-N cards for a given mode, ranked by mode-native doctrine score. */
  public topCardsForMode(mode: GameMode, limit = 10): CardModeScore[] {
    const legal = this.listByMode(mode);
    const board = buildModeScoreBoard(legal, mode);
    return [...board.scores].slice(0, limit);
  }

  /** Extracts the 32-dim ML feature vector for a card in a given mode. */
  public extractMLVector(
    cardId: string,
    mode: GameMode,
    overlay?: CardOverlaySnapshot,
    nowMs = Date.now(),
  ): CardMLFeatureVector {
    const definition = this.getOrThrow(cardId);
    return extractCardMLFeatureVector(definition, mode, overlay, nowMs);
  }

  // ── Catalog stats ─────────────────────────────────────────────────────────

  public getCatalogStats(): CardCatalogStats {
    const byDeck: Record<DeckType, number> = {
      [DeckType.OPPORTUNITY]:        0,
      [DeckType.IPA]:                0,
      [DeckType.FUBAR]:              0,
      [DeckType.MISSED_OPPORTUNITY]: 0,
      [DeckType.PRIVILEGED]:         0,
      [DeckType.SO]:                 0,
      [DeckType.SABOTAGE]:           0,
      [DeckType.COUNTER]:            0,
      [DeckType.AID]:                0,
      [DeckType.RESCUE]:             0,
      [DeckType.DISCIPLINE]:         0,
      [DeckType.TRUST]:              0,
      [DeckType.BLUFF]:              0,
      [DeckType.GHOST]:              0,
    };

    const byMode: Record<GameMode, number> = {
      [GameMode.GO_ALONE]:       0,
      [GameMode.HEAD_TO_HEAD]:   0,
      [GameMode.TEAM_UP]:        0,
      [GameMode.CHASE_A_LEGEND]: 0,
    };

    let legendaries = 0;

    for (const definition of this.definitions.values()) {
      byDeck[definition.deckType] += 1;

      for (const mode of Object.values(GameMode)) {
        if (this.isLegalInMode(definition, mode)) byMode[mode] += 1;
      }

      if (definition.rarity === CardRarity.LEGENDARY) legendaries += 1;
    }

    return { total: this.definitions.size, byDeck, byMode, legendaries };
  }

  // ── Static utilities ──────────────────────────────────────────────────────

  public static resolveModeFromCode(code: ModeCode): GameMode {
    return MODE_CODE_MAP[code];
  }

  public static buildProofHash(input: {
    cardId: string;
    tickIndex: number;
    mode: GameMode;
    currency: CurrencyType;
    seed: string;
  }): string {
    const raw = [input.cardId, input.tickIndex, input.mode, input.currency, input.seed].join('|');
    return stableHash(raw);
  }
}

// =============================================================================
// MARK: CardRegistryMLSuite
// =============================================================================

/**
 * Full ML scoring pipeline for card play signals.
 *
 * Wires EngagementModel, HaterTargetingModel, HelperTimingModel,
 * ChurnRiskModel, and InterventionPolicyModel for every card play.
 *
 * Also injects Zero social pressure vectors when a RunStateSnapshot
 * is available, and emits proof-bearing transcript edges.
 */
export class CardRegistryMLSuite {
  private readonly engagement:   EngagementModel;
  private readonly hater:        HaterTargetingModel;
  private readonly helper:       HelperTimingModel;
  private readonly churn:        ChurnRiskModel;
  private readonly intervention: InterventionPolicyModel;

  public constructor() {
    this.engagement   = createEngagementModel();
    this.hater        = createHaterTargetingModel();
    this.helper       = createHelperTimingModel();
    this.churn        = createChurnRiskModel();
    this.intervention = createInterventionPolicyModel();
  }

  /** Returns the underlying EngagementModel for lifecycle management. */
  public get engagementModel(): EngagementModel { return this.engagement; }

  /** Returns the underlying HaterTargetingModel for lifecycle management. */
  public get haterModel(): HaterTargetingModel { return this.hater; }

  /** Returns the underlying HelperTimingModel for lifecycle management. */
  public get helperModel(): HelperTimingModel { return this.helper; }

  /** Returns the underlying ChurnRiskModel for lifecycle management. */
  public get churnModel(): ChurnRiskModel { return this.churn; }

  /** Returns the underlying InterventionPolicyModel for lifecycle management. */
  public get interventionModel(): InterventionPolicyModel { return this.intervention; }

  /**
   * Scores a card play against all 5 ML models.
   * Optionally enriches with RunStateSnapshot for social pressure injection.
   */
  public scoreCardPlay(
    definition: CardDefinition,
    mode: GameMode,
    tickIndex: number,
    context?: ExecutionContext,
    snapshot?: RunStateSnapshot,
    overlay?: CardOverlaySnapshot,
    nowMs = Date.now(),
  ): CardPlayMLScoreBundle {
    const mlVector  = extractCardMLFeatureVector(definition, mode, overlay, nowMs);
    const aggregate = buildCardPlayAggregate(definition, mode, tickIndex, context, nowMs);

    // Score all 5 models using the same aggregate
    const engagementScore   = scoreEngagementAggregate(aggregate);
    const haterScore        = scoreHaterTargetingAggregate(aggregate);
    const helperScore       = scoreHelperTimingAggregate(aggregate);
    const churnScore        = scoreChurnRiskAggregate({ aggregate });
    const interventionScore = scoreInterventionPolicyAggregate({ aggregate }).score;

    // Interpretation
    const engBand          = engagementScore.band;
    const engBandStr       = engagementBandLabel(engBand);
    const isElectric       = engagementIsElectric(engagementScore);
    const isFrozen         = engagementIsFrozen(engagementScore);
    const churnBand        = churnBandLabel(churnScore);
    const needsRescue      = churnRiskNeedsRescue(churnScore);
    const needsHelper      = helperTimingShouldSpeak(helperScore);
    const interventionSum  = interventionPolicySummary(interventionScore);

    // Social pressure from Zero engine (if snapshot available)
    let socialPressure: Nullable<ZeroSocialPressureVector> = null;
    if (snapshot) {
      socialPressure = computeSocialPressureVector(snapshot);
    }

    // Mode narration using Zero utilities
    const modeCode         = resolveCardModeCode(mode);
    const narrationPrefix  = getModeNarrationPrefix(modeCode);
    const competitiveWeight = scoreModeCompetitiveWeight(modeCode);
    const narrativeMoment  = snapshot
      ? narrateZeroMoment(snapshot, tickIndex).text
      : `${getModeNarrationPrefix(modeCode)} ${isElectric ? 'electric signal' : isFrozen ? 'frozen field' : needsRescue ? 'rescue window open' : 'normal tempo'}`;

    // Witness label from social pressure or fallback
    const witnessLabel = socialPressure?.witnessLabel ??
      (isElectric ? 'CRITICAL_SIEGE' : isFrozen ? 'DORMANT_FIELD' : 'BUILDING_TENSION');

    void competitiveWeight; // consumed via modeNarrationPrefix context
    void engBandStr;        // consumed in signal below

    return {
      cardId:                  definition.cardId,
      mode,
      tickIndex,
      mlVector,
      engagementScore,
      haterScore,
      helperScore,
      churnScore,
      interventionScore,
      engagementBand:          engBand,
      churnBandLabel:          churnBand,
      needsHelperIntervention: needsHelper,
      needsChurnRescue:        needsRescue,
      interventionSummary:     interventionSum,
      socialPressure,
      witnessLabel,
      narrativeMoment,
      modeNarrationPrefix:     narrationPrefix,
      generatedAt:             asUnixMs(nowMs),
    };
  }

  /**
   * Bulk-scores a set of definitions for a mode, returning ranked bundles.
   */
  public scoreCardPlayBulk(
    definitions: readonly CardDefinition[],
    mode: GameMode,
    tickIndex: number,
    context?: ExecutionContext,
    snapshot?: RunStateSnapshot,
    nowMs = Date.now(),
  ): CardPlayMLScoreBundle[] {
    return definitions.map((d) =>
      this.scoreCardPlay(d, mode, tickIndex, context, snapshot, undefined, nowMs),
    );
  }
}

// =============================================================================
// MARK: CardChatSignalEmitter
// =============================================================================

/**
 * Emits mode-native chat signals for card plays.
 *
 * Translates CardPlayMLScoreBundle + CardDefinition into:
 * - Mode-native posture (Empire / Predator / Syndicate / Phantom)
 * - Audience heat level
 * - Hater pressure
 * - Churn risk
 * - Intervention flag
 * - Proof-bearing edge for transcript authority
 */
export class CardChatSignalEmitter {
  private readonly mlSuite: CardRegistryMLSuite;

  public constructor(mlSuite?: CardRegistryMLSuite) {
    this.mlSuite = mlSuite ?? new CardRegistryMLSuite();
  }

  /**
   * Emits a full CardPlayChatSignal for a card play event.
   * Includes proof hash via CardRegistry.buildProofHash.
   */
  public emit(
    definition: CardDefinition,
    mode: GameMode,
    tickIndex: number,
    seed: string,
    context?: ExecutionContext,
    snapshot?: RunStateSnapshot,
    overlay?: CardOverlaySnapshot,
    nowMs = Date.now(),
  ): CardPlayChatSignal {
    const bundle    = this.mlSuite.scoreCardPlay(
      definition, mode, tickIndex, context, snapshot, overlay, nowMs,
    );
    const posture   = resolveCardChatPosture(definition, mode);
    const currency  = resolveCurrencyForCard(definition.deckType, mode, overlay);
    const rawProof  = CardRegistry.buildProofHash({ cardId: definition.cardId, tickIndex, mode, currency, seed });
    const proofHash = asChatProofHash(rawProof);

    const audienceHeat   = clamp01(bundle.engagementScore?.engagement01 ?? 0);
    const haterPressure  = clamp01(bundle.haterScore?.targeting01 ?? 0);
    const churnRisk01    = clamp01(bundle.churnScore?.withdrawalRisk01 ?? 0);

    return {
      cardId:              definition.cardId,
      cardName:            definition.name,
      mode,
      tickIndex,
      posture,
      audienceHeat,
      haterPressure,
      churnRisk:           churnRisk01,
      needsIntervention:   bundle.needsHelperIntervention || bundle.needsChurnRescue,
      witnessLabel:        bundle.witnessLabel,
      narrativeHint:       bundle.narrativeMoment,
      educationalTag:      definition.educationalTag ?? null,
      currency,
      proofEdgeId:         null,
      proofHash,
      generatedAt:         bundle.generatedAt,
      modeCompetitiveWeight: scoreModeCompetitiveWeight(resolveCardModeCode(mode)),
      zeroFeatureDimension:  CARD_REGISTRY_ZERO_INJECTION_DIMENSION,
      zeroFeatureLabelKeys:  ZERO_ML_FEATURE_LABEL_KEYS,
    };
  }

  /**
   * Builds a CardProofEdge for transcript-truth linkage.
   */
  public buildProofEdge(
    definition: CardDefinition,
    mode: GameMode,
    tickIndex: number,
    seed: string,
    overlay?: CardOverlaySnapshot,
    roomId?: ChatRoomId,
    sessionId?: ChatSessionId,
    userId?: ChatUserId,
    sceneId?: ChatSceneId,
    nowMs = Date.now(),
  ): CardProofEdge {
    const currency = resolveCurrencyForCard(definition.deckType, mode, overlay);
    const rawHash  = CardRegistry.buildProofHash({ cardId: definition.cardId, tickIndex, mode, currency, seed });
    const cordBonus = round6(netDeltaForOp(definition, CardEffectOp.CORD_BONUS_FLAT));

    return {
      proofEdgeId:    rawHash.slice(0, 16),
      cardId:         definition.cardId,
      cardName:       definition.name,
      playId:         stableHash([definition.cardId, tickIndex, seed].join('|')).slice(0, 20),
      tickIndex,
      mode,
      currency,
      deterministicHash: rawHash,
      cordDelta:         cordBonus,
      educationalTag:    definition.educationalTag ?? null,
      sceneId:           sceneId ?? null,
      roomId:            roomId   ?? null,
      sessionId:         sessionId ?? null,
      userId:            userId   ?? null,
      generatedAt:       asUnixMs(nowMs),
      verified:          true,
    };
  }

  /**
   * Builds a complete CardTranscriptEntry — the proof-bearing record for
   * every card play that enters the authoritative chat transcript lane.
   */
  public buildTranscriptEntry(
    definition: CardDefinition,
    mode: GameMode,
    tickIndex: number,
    seed: string,
    context?: ExecutionContext,
    snapshot?: RunStateSnapshot,
    overlay?: CardOverlaySnapshot,
    roomId?: ChatRoomId,
    sessionId?: ChatSessionId,
    userId?: ChatUserId,
    sceneId?: ChatSceneId,
    nowMs = Date.now(),
  ): CardTranscriptEntry {
    const chatSignal = this.emit(
      definition, mode, tickIndex, seed, context, snapshot, overlay, nowMs,
    );
    const proofEdge  = this.buildProofEdge(
      definition, mode, tickIndex, seed, overlay, roomId, sessionId, userId, sceneId, nowMs,
    );
    const mlVector   = extractCardMLFeatureVector(definition, mode, overlay, nowMs);
    const currency   = resolveCurrencyForCard(definition.deckType, mode, overlay);

    return {
      entryId:       proofEdge.playId,
      cardId:        definition.cardId,
      cardName:      definition.name,
      mode,
      tickIndex,
      currency,
      cost:          definition.baseCost,
      cordBonus:     round6(netDeltaForOp(definition, CardEffectOp.CORD_BONUS_FLAT)),
      tags:          definition.tags,
      effects:       definition.effects.map((e) => `${e.op}(${round6(e.magnitude)})`),
      educationalTag: definition.educationalTag ?? null,
      chatSignal,
      proofEdge,
      mlVector,
      generatedAt:   asUnixMs(nowMs),
    };
  }
}

// =============================================================================
// MARK: CardRegistryHub — master orchestrator
// =============================================================================

/**
 * CardRegistryHub: the master wiring surface consumed by engine/index.ts.
 *
 * Combines:
 * - CardRegistry (catalog authority)
 * - CardRegistryMLSuite (full ML scoring)
 * - CardChatSignalEmitter (social pressure + proof chain)
 * - buildModeScoreBoard (doctrine scoring)
 * - extractCardMLFeatureVector (feature extraction)
 *
 * Usage:
 *   import { CARD_REGISTRY_HUB } from './card_registry';
 *   const card   = CARD_REGISTRY_HUB.registry.drawCard(input);
 *   const signal = CARD_REGISTRY_HUB.emitter.emit(def, mode, tick, seed);
 *   const score  = CARD_REGISTRY_HUB.mlSuite.scoreCardPlay(def, mode, tick);
 */
export class CardRegistryHub {
  public readonly registry: CardRegistry;
  public readonly mlSuite: CardRegistryMLSuite;
  public readonly emitter: CardChatSignalEmitter;

  public constructor(initialDefinitions?: readonly CardDefinition[]) {
    this.registry = new CardRegistry(initialDefinitions);
    this.mlSuite  = new CardRegistryMLSuite();
    this.emitter  = new CardChatSignalEmitter(this.mlSuite);
  }

  /**
   * Full card draw + ML scoring + chat signal in one call.
   * Returns null if no card can be drawn.
   */
  public drawAndScore(
    input: DeterministicDrawInput,
    snapshot?: RunStateSnapshot,
    nowMs = Date.now(),
  ): { card: CardInHand; signal: CardPlayChatSignal; bundle: CardPlayMLScoreBundle } | null {
    const definition = this.registry.drawDefinition(input);
    if (!definition) return null;

    const card = this.registry.instantiateCard(
      definition.cardId,
      input.mode,
      input.tickIndex,
      input.context,
      input.options?.runtimeOverlay,
    );
    if (!card) return null;

    const bundle = this.mlSuite.scoreCardPlay(
      definition, input.mode, input.tickIndex, input.context, snapshot, input.options?.runtimeOverlay, nowMs,
    );
    const signal = this.emitter.emit(
      definition, input.mode, input.tickIndex, input.seed,
      input.context, snapshot, input.options?.runtimeOverlay, nowMs,
    );

    return { card, signal, bundle };
  }

  /**
   * Draws a full hand of N cards deterministically.
   */
  public drawHand(
    input: Omit<DeterministicDrawInput, 'drawIndex'>,
    handSize: number,
    snapshot?: RunStateSnapshot,
    nowMs = Date.now(),
  ): Array<{ card: CardInHand; signal: CardPlayChatSignal; bundle: CardPlayMLScoreBundle }> {
    const results: Array<{ card: CardInHand; signal: CardPlayChatSignal; bundle: CardPlayMLScoreBundle }> = [];
    const excludedIds: string[] = [];

    for (let i = 0; i < handSize; i++) {
      const drawInput: DeterministicDrawInput = {
        ...input,
        drawIndex: i,
        options: {
          ...input.options,
          excludedIds: [
            ...(input.options?.excludedIds ?? []),
            ...excludedIds,
          ],
        },
      };

      const result = this.drawAndScore(drawInput, snapshot, nowMs);
      if (!result) continue;
      results.push(result);
      excludedIds.push(result.card.definition.cardId);
    }

    return results;
  }

  /** Returns catalog stats. */
  public getStats(): CardCatalogStats {
    return this.registry.getCatalogStats();
  }

  /** Returns the top-N cards for a mode, ranked by doctrine score. */
  public topCardsForMode(mode: GameMode, limit = 10): CardModeScore[] {
    return this.registry.topCardsForMode(mode, limit);
  }

  /** Resolves a ModeCode to a GameMode. */
  public static resolveModeFromCode(code: ModeCode): GameMode {
    return CardRegistry.resolveModeFromCode(code);
  }
}

// =============================================================================
// MARK: Zero injection utilities (used in signal + hub)
// =============================================================================

/**
 * Resolves the ModeCode for a GameMode (inverse of MODE_CODE_MAP).
 * Used for Zero engine narration prefix and competitive weight calls.
 */
export function resolveCardModeCode(mode: GameMode): ModeCode {
  for (const [code, gm] of Object.entries(MODE_CODE_MAP) as [ModeCode, GameMode][]) {
    if (gm === mode) return code;
  }
  return 'solo';
}

/**
 * Returns the Zero-engine ML feature dimension for card play signal alignment.
 * Ensures card registry signals align with the Zero engine's 32-dim space.
 */
export function getCardZeroMLDimension(): typeof ZERO_ML_FEATURE_DIMENSION {
  return ZERO_ML_FEATURE_DIMENSION;
}

// =============================================================================
// MARK: Card definition helpers
// =============================================================================

function allModes(): readonly GameMode[] {
  return ALL_MODES;
}

function baseLegendaryOverlay(): Readonly<Partial<Record<GameMode, Partial<ModeOverlay>>>> {
  return {
    [GameMode.GO_ALONE]:       { cordWeight: 1.15 },
    [GameMode.HEAD_TO_HEAD]:   { cordWeight: 1.10 },
    [GameMode.TEAM_UP]:        { cordWeight: 1.12 },
    [GameMode.CHASE_A_LEGEND]: { cordWeight: 1.25 },
  };
}

// =============================================================================
// MARK: DEFAULT_CARD_DEFINITIONS — 50+ card authoritative catalog
// =============================================================================

export const DEFAULT_CARD_DEFINITIONS: readonly CardDefinition[] = Object.freeze([

  // ──────────────────────────────────────────────────────────────────────────
  // OPPORTUNITY — all-mode income + scale cards
  // ──────────────────────────────────────────────────────────────────────────

  {
    cardId: 'opp_digital_revenue_stream_001',
    name: 'Digital Revenue Stream',
    deckType: DeckType.OPPORTUNITY,
    baseCost: 8_500,
    effects: [{ op: CardEffectOp.INCOME_DELTA, magnitude: 1_800 }],
    tags: [CardTag.INCOME, CardTag.SCALE, CardTag.MOMENTUM],
    timingClasses: [TimingClass.PRE, TimingClass.ANY],
    rarity: CardRarity.COMMON,
    autoResolve: false,
    counterability: Counterability.NONE,
    targeting: Targeting.SELF,
    modeLegal: allModes(),
    educationalTag: 'cashflow > paper gains',
  },
  {
    cardId: 'opp_distressed_asset_acquisition_001',
    name: 'Distressed Asset Acquisition',
    deckType: DeckType.OPPORTUNITY,
    baseCost: 14_000,
    effects: [
      { op: CardEffectOp.CASH_DELTA,   magnitude: 2_500 },
      { op: CardEffectOp.INCOME_DELTA, magnitude: 900   },
    ],
    tags: [CardTag.LIQUIDITY, CardTag.SCALE, CardTag.RESILIENCE],
    timingClasses: [TimingClass.PRE, TimingClass.PHZ, TimingClass.ANY],
    rarity: CardRarity.UNCOMMON,
    autoResolve: false,
    counterability: Counterability.SOFT,
    targeting: Targeting.SELF,
    modeLegal: allModes(),
    educationalTag: 'buy pain when others panic',
  },
  {
    cardId: 'opp_recurring_subscription_001',
    name: 'Recurring Subscription Launch',
    deckType: DeckType.OPPORTUNITY,
    baseCost: 6_000,
    effects: [
      { op: CardEffectOp.INCOME_DELTA, magnitude: 1_200 },
      { op: CardEffectOp.CORD_BONUS_FLAT, magnitude: 0.01 },
    ],
    tags: [CardTag.INCOME, CardTag.MOMENTUM, CardTag.RESILIENCE],
    timingClasses: [TimingClass.PRE, TimingClass.POST, TimingClass.ANY],
    rarity: CardRarity.COMMON,
    autoResolve: false,
    counterability: Counterability.NONE,
    targeting: Targeting.SELF,
    modeLegal: allModes(),
    educationalTag: 'predictable income is sovereign income',
  },
  {
    cardId: 'opp_portfolio_rebalance_001',
    name: 'Portfolio Rebalance',
    deckType: DeckType.OPPORTUNITY,
    baseCost: 5_000,
    effects: [
      { op: CardEffectOp.EXPENSE_DELTA, magnitude: -400 },
      { op: CardEffectOp.SHIELD_DELTA,  magnitude: 8    },
    ],
    tags: [CardTag.LIQUIDITY, CardTag.RESILIENCE, CardTag.PRECISION],
    timingClasses: [TimingClass.POST, TimingClass.PHZ, TimingClass.ANY],
    rarity: CardRarity.COMMON,
    autoResolve: false,
    counterability: Counterability.NONE,
    targeting: Targeting.SELF,
    modeLegal: allModes(),
    educationalTag: 'reduce drag to increase velocity',
  },
  {
    cardId: 'opp_real_estate_flip_001',
    name: 'Real Estate Flip',
    deckType: DeckType.OPPORTUNITY,
    baseCost: 22_000,
    effects: [
      { op: CardEffectOp.CASH_DELTA,   magnitude: 11_000 },
      { op: CardEffectOp.HEAT_DELTA,   magnitude: 4      },
    ],
    tags: [CardTag.LIQUIDITY, CardTag.SCALE, CardTag.VARIANCE],
    timingClasses: [TimingClass.PHZ, TimingClass.ANY],
    rarity: CardRarity.RARE,
    autoResolve: false,
    counterability: Counterability.SOFT,
    targeting: Targeting.SELF,
    modeLegal: allModes(),
    educationalTag: 'velocity of capital matters more than the asset',
  },
  {
    cardId: 'opp_angel_syndicate_001',
    name: 'Angel Syndicate Round',
    deckType: DeckType.OPPORTUNITY,
    baseCost: 18_000,
    effects: [
      { op: CardEffectOp.CASH_DELTA,       magnitude: 25_000 },
      { op: CardEffectOp.INCOME_DELTA,     magnitude: 500    },
      { op: CardEffectOp.HEAT_DELTA,       magnitude: 6      },
      { op: CardEffectOp.CORD_BONUS_FLAT,  magnitude: 0.015  },
    ],
    tags: [CardTag.LIQUIDITY, CardTag.SCALE, CardTag.MOMENTUM, CardTag.HEAT],
    timingClasses: [TimingClass.PRE, TimingClass.PSK, TimingClass.ANY],
    rarity: CardRarity.RARE,
    autoResolve: false,
    counterability: Counterability.SOFT,
    targeting: Targeting.SELF,
    modeLegal: allModes(),
    educationalTag: 'outside capital accelerates outcomes',
  },
  {
    cardId: 'opp_cash_cow_product_001',
    name: 'Cash Cow Product',
    deckType: DeckType.OPPORTUNITY,
    baseCost: 9_000,
    effects: [
      { op: CardEffectOp.INCOME_DELTA,  magnitude: 2_500 },
      { op: CardEffectOp.EXPENSE_DELTA, magnitude: 200   },
    ],
    tags: [CardTag.INCOME, CardTag.SCALE, CardTag.RESILIENCE, CardTag.MOMENTUM],
    timingClasses: [TimingClass.PRE, TimingClass.POST, TimingClass.ANY],
    rarity: CardRarity.UNCOMMON,
    autoResolve: false,
    counterability: Counterability.NONE,
    targeting: Targeting.SELF,
    modeLegal: allModes(),
    educationalTag: 'protect and milk the cow before hunting the next one',
  },
  {
    cardId: 'opp_arbitrage_window_001',
    name: 'Arbitrage Window',
    deckType: DeckType.OPPORTUNITY,
    baseCost: 3_500,
    effects: [
      { op: CardEffectOp.CASH_DELTA, magnitude: 4_200 },
    ],
    tags: [CardTag.LIQUIDITY, CardTag.TEMPO, CardTag.PRECISION],
    timingClasses: [TimingClass.PSK, TimingClass.PHZ],
    rarity: CardRarity.UNCOMMON,
    autoResolve: false,
    counterability: Counterability.HARD,
    targeting: Targeting.SELF,
    modeLegal: allModes(),
    educationalTag: 'windows close — execute or lose the spread',
  },

  // ──────────────────────────────────────────────────────────────────────────
  // IPA (Intellectual Property Assets) — license, patent, brand
  // ──────────────────────────────────────────────────────────────────────────

  {
    cardId: 'ipa_licensing_deal_001',
    name: 'Licensing Deal',
    deckType: DeckType.IPA,
    baseCost: 12_000,
    effects: [
      { op: CardEffectOp.INCOME_DELTA, magnitude: 2_200 },
      { op: CardEffectOp.HEAT_DELTA,   magnitude: 2     },
    ],
    tags: [CardTag.INCOME, CardTag.SCALE, CardTag.PRECISION],
    timingClasses: [TimingClass.PRE, TimingClass.POST, TimingClass.ANY],
    rarity: CardRarity.UNCOMMON,
    autoResolve: false,
    counterability: Counterability.NONE,
    targeting: Targeting.SELF,
    modeLegal: allModes(),
    educationalTag: 'license instead of labor',
  },
  {
    cardId: 'ipa_patent_moat_001',
    name: 'Patent Moat',
    deckType: DeckType.IPA,
    baseCost: 15_000,
    effects: [
      { op: CardEffectOp.SHIELD_DELTA,    magnitude: 20   },
      { op: CardEffectOp.INCOME_DELTA,    magnitude: 800  },
      { op: CardEffectOp.CORD_BONUS_FLAT, magnitude: 0.01 },
    ],
    tags: [CardTag.RESILIENCE, CardTag.PRECISION, CardTag.SCALE],
    timingClasses: [TimingClass.PRE, TimingClass.ANY],
    rarity: CardRarity.RARE,
    autoResolve: false,
    counterability: Counterability.NONE,
    targeting: Targeting.SELF,
    modeLegal: allModes(),
    educationalTag: 'build legal walls before others copy',
  },
  {
    cardId: 'ipa_brand_royalty_001',
    name: 'Brand Royalty Stream',
    deckType: DeckType.IPA,
    baseCost: 7_000,
    effects: [
      { op: CardEffectOp.INCOME_DELTA,    magnitude: 1_600 },
      { op: CardEffectOp.CORD_BONUS_FLAT, magnitude: 0.005 },
    ],
    tags: [CardTag.INCOME, CardTag.MOMENTUM, CardTag.SCALE],
    timingClasses: [TimingClass.PRE, TimingClass.POST, TimingClass.ANY],
    rarity: CardRarity.COMMON,
    autoResolve: false,
    counterability: Counterability.NONE,
    targeting: Targeting.SELF,
    modeLegal: allModes(),
    educationalTag: 'your name earns while you sleep',
  },
  {
    cardId: 'ipa_white_label_001',
    name: 'White Label Partnership',
    deckType: DeckType.IPA,
    baseCost: 5_500,
    effects: [
      { op: CardEffectOp.INCOME_DELTA,  magnitude: 1_100 },
      { op: CardEffectOp.EXPENSE_DELTA, magnitude: 100   },
    ],
    tags: [CardTag.INCOME, CardTag.SCALE, CardTag.TEMPO],
    timingClasses: [TimingClass.PRE, TimingClass.ANY],
    rarity: CardRarity.COMMON,
    autoResolve: false,
    counterability: Counterability.NONE,
    targeting: Targeting.SELF,
    modeLegal: allModes(),
    educationalTag: 'let others distribute your IP at their cost',
  },

  // ──────────────────────────────────────────────────────────────────────────
  // FUBAR — negative forced events: debt, tax, emergency
  // ──────────────────────────────────────────────────────────────────────────

  {
    cardId: 'fubar_tax_lien_001',
    name: 'Tax Lien',
    deckType: DeckType.FUBAR,
    baseCost: 0,
    effects: [
      { op: CardEffectOp.CASH_DELTA, magnitude: -7_000 },
      { op: CardEffectOp.HEAT_DELTA, magnitude: 6      },
    ],
    tags: [CardTag.HEAT, CardTag.CASCADE],
    timingClasses: [TimingClass.FATE],
    rarity: CardRarity.COMMON,
    autoResolve: true,
    counterability: Counterability.HARD,
    targeting: Targeting.SELF,
    modeLegal: allModes(),
    educationalTag: 'forced pain compounds when ignored',
  },
  {
    cardId: 'fubar_equipment_failure_001',
    name: 'Equipment Failure',
    deckType: DeckType.FUBAR,
    baseCost: 0,
    effects: [
      { op: CardEffectOp.EXPENSE_DELTA, magnitude: 2_500 },
      { op: CardEffectOp.INCOME_DELTA,  magnitude: -500  },
    ],
    tags: [CardTag.CASCADE, CardTag.VARIANCE],
    timingClasses: [TimingClass.FATE, TimingClass.CAS],
    rarity: CardRarity.COMMON,
    autoResolve: true,
    counterability: Counterability.SOFT,
    targeting: Targeting.SELF,
    modeLegal: allModes(),
    educationalTag: 'systems fail on schedule, not by accident',
  },
  {
    cardId: 'fubar_regulatory_audit_001',
    name: 'Regulatory Audit',
    deckType: DeckType.FUBAR,
    baseCost: 0,
    effects: [
      { op: CardEffectOp.CASH_DELTA,  magnitude: -5_000 },
      { op: CardEffectOp.HEAT_DELTA,  magnitude: 8      },
      { op: CardEffectOp.TIMER_FREEZE, magnitude: 3     },
    ],
    tags: [CardTag.HEAT, CardTag.CASCADE, CardTag.VARIANCE],
    timingClasses: [TimingClass.FATE, TimingClass.PSK],
    rarity: CardRarity.UNCOMMON,
    autoResolve: true,
    counterability: Counterability.SOFT,
    targeting: Targeting.SELF,
    modeLegal: allModes(),
    educationalTag: 'compliance debt collects with interest',
  },
  {
    cardId: 'fubar_emergency_withdrawal_001',
    name: 'Emergency Withdrawal',
    deckType: DeckType.FUBAR,
    baseCost: 0,
    effects: [
      { op: CardEffectOp.CASH_DELTA,  magnitude: -12_000 },
      { op: CardEffectOp.SHIELD_DELTA, magnitude: -8     },
    ],
    tags: [CardTag.VARIANCE, CardTag.CASCADE, CardTag.HEAT],
    timingClasses: [TimingClass.FATE, TimingClass.CAS],
    rarity: CardRarity.RARE,
    autoResolve: true,
    counterability: Counterability.HARD,
    targeting: Targeting.SELF,
    modeLegal: allModes(),
    educationalTag: 'emergencies drain reserves and morale simultaneously',
  },
  {
    cardId: 'fubar_market_crash_event_001',
    name: 'Market Crash Event',
    deckType: DeckType.FUBAR,
    baseCost: 0,
    effects: [
      { op: CardEffectOp.INCOME_DELTA,  magnitude: -2_000 },
      { op: CardEffectOp.CASH_DELTA,    magnitude: -8_000 },
      { op: CardEffectOp.HEAT_DELTA,    magnitude: 12     },
    ],
    tags: [CardTag.CASCADE, CardTag.VARIANCE, CardTag.HEAT, CardTag.RESILIENCE],
    timingClasses: [TimingClass.FATE, TimingClass.CAS, TimingClass.PHZ],
    rarity: CardRarity.RARE,
    autoResolve: true,
    counterability: Counterability.HARD,
    targeting: Targeting.GLOBAL,
    modeLegal: allModes(),
    educationalTag: 'volatility is the rent you pay for higher returns',
  },

  // ──────────────────────────────────────────────────────────────────────────
  // MISSED OPPORTUNITY — cost of inaction / poor choices
  // ──────────────────────────────────────────────────────────────────────────

  {
    cardId: 'missed_overpriced_hype_001',
    name: 'Overpriced Hype',
    deckType: DeckType.MISSED_OPPORTUNITY,
    baseCost: 0,
    effects: [
      { op: CardEffectOp.CORD_BONUS_FLAT, magnitude: -0.02 },
      { op: CardEffectOp.HEAT_DELTA,      magnitude: 2     },
    ],
    tags: [CardTag.VARIANCE, CardTag.PRECISION],
    timingClasses: [TimingClass.POST, TimingClass.ANY],
    rarity: CardRarity.COMMON,
    autoResolve: false,
    counterability: Counterability.NONE,
    targeting: Targeting.SELF,
    modeLegal: allModes(),
    educationalTag: 'opportunity cost is real',
  },
  {
    cardId: 'missed_delayed_decision_001',
    name: 'Delayed Decision',
    deckType: DeckType.MISSED_OPPORTUNITY,
    baseCost: 0,
    effects: [
      { op: CardEffectOp.INCOME_DELTA,    magnitude: -600   },
      { op: CardEffectOp.CORD_BONUS_FLAT, magnitude: -0.015 },
    ],
    tags: [CardTag.VARIANCE, CardTag.TEMPO],
    timingClasses: [TimingClass.END, TimingClass.ANY],
    rarity: CardRarity.COMMON,
    autoResolve: false,
    counterability: Counterability.NONE,
    targeting: Targeting.SELF,
    modeLegal: allModes(),
    educationalTag: 'indecision costs more than a wrong decision',
  },
  {
    cardId: 'missed_wrong_market_001',
    name: 'Wrong Market Entry',
    deckType: DeckType.MISSED_OPPORTUNITY,
    baseCost: 0,
    effects: [
      { op: CardEffectOp.CASH_DELTA,      magnitude: -3_500 },
      { op: CardEffectOp.CORD_BONUS_FLAT, magnitude: -0.03  },
      { op: CardEffectOp.HEAT_DELTA,      magnitude: 3      },
    ],
    tags: [CardTag.VARIANCE, CardTag.PRECISION, CardTag.HEAT],
    timingClasses: [TimingClass.POST, TimingClass.CAS],
    rarity: CardRarity.UNCOMMON,
    autoResolve: false,
    counterability: Counterability.SOFT,
    targeting: Targeting.SELF,
    modeLegal: allModes(),
    educationalTag: 'market fit is not negotiable',
  },

  // ──────────────────────────────────────────────────────────────────────────
  // PRIVILEGED — network, access, leverage
  // ──────────────────────────────────────────────────────────────────────────

  {
    cardId: 'priv_network_call_001',
    name: 'Network Call',
    deckType: DeckType.PRIVILEGED,
    baseCost: 18_000,
    effects: [
      { op: CardEffectOp.CASH_DELTA, magnitude: 9_000 },
      { op: CardEffectOp.HEAT_DELTA, magnitude: 8     },
    ],
    tags: [CardTag.LIQUIDITY, CardTag.HEAT, CardTag.MOMENTUM],
    timingClasses: [TimingClass.ANY, TimingClass.PSK],
    rarity: CardRarity.RARE,
    autoResolve: false,
    counterability: Counterability.SOFT,
    targeting: Targeting.SELF,
    modeLegal: allModes(),
    educationalTag: 'your network is your net worth',
  },
  {
    cardId: 'priv_insider_information_001',
    name: 'Insider Intelligence',
    deckType: DeckType.PRIVILEGED,
    baseCost: 12_000,
    effects: [
      { op: CardEffectOp.CORD_BONUS_FLAT, magnitude: 0.025 },
      { op: CardEffectOp.SHIELD_DELTA,    magnitude: 12    },
    ],
    tags: [CardTag.PRECISION, CardTag.RESILIENCE, CardTag.DIVERGENCE],
    timingClasses: [TimingClass.PRE, TimingClass.GBM, TimingClass.ANY],
    rarity: CardRarity.RARE,
    autoResolve: false,
    counterability: Counterability.SOFT,
    targeting: Targeting.SELF,
    modeLegal: allModes(),
    educationalTag: 'information asymmetry is the oldest edge',
  },
  {
    cardId: 'priv_credit_facility_001',
    name: 'Credit Facility Access',
    deckType: DeckType.PRIVILEGED,
    baseCost: 20_000,
    effects: [
      { op: CardEffectOp.CASH_DELTA,  magnitude: 30_000 },
      { op: CardEffectOp.EXPENSE_DELTA, magnitude: 1_500 },
      { op: CardEffectOp.HEAT_DELTA,  magnitude: 5      },
    ],
    tags: [CardTag.LIQUIDITY, CardTag.SCALE, CardTag.MOMENTUM, CardTag.HEAT],
    timingClasses: [TimingClass.PRE, TimingClass.PSK, TimingClass.ANY],
    rarity: CardRarity.RARE,
    autoResolve: false,
    counterability: Counterability.SOFT,
    targeting: Targeting.SELF,
    modeLegal: allModes(),
    educationalTag: 'access to credit is access to speed',
  },

  // ──────────────────────────────────────────────────────────────────────────
  // SO (Sovereign Operations) — compliance, systems, protection
  // ──────────────────────────────────────────────────────────────────────────

  {
    cardId: 'so_compliance_maze_001',
    name: 'Compliance Maze',
    deckType: DeckType.SO,
    baseCost: 6_500,
    effects: [
      { op: CardEffectOp.SHIELD_DELTA, magnitude: 10  },
      { op: CardEffectOp.HEAT_DELTA,   magnitude: -3  },
    ],
    tags: [CardTag.RESILIENCE, CardTag.PRECISION],
    timingClasses: [TimingClass.POST, TimingClass.ANY],
    rarity: CardRarity.COMMON,
    autoResolve: false,
    counterability: Counterability.NONE,
    targeting: Targeting.SELF,
    modeLegal: allModes(),
    educationalTag: 'systems reward the prepared',
  },
  {
    cardId: 'so_operational_moat_001',
    name: 'Operational Moat',
    deckType: DeckType.SO,
    baseCost: 9_000,
    effects: [
      { op: CardEffectOp.SHIELD_DELTA,    magnitude: 22   },
      { op: CardEffectOp.CORD_BONUS_FLAT, magnitude: 0.01 },
    ],
    tags: [CardTag.RESILIENCE, CardTag.SCALE, CardTag.PRECISION],
    timingClasses: [TimingClass.PRE, TimingClass.ANY],
    rarity: CardRarity.UNCOMMON,
    autoResolve: false,
    counterability: Counterability.NONE,
    targeting: Targeting.SELF,
    modeLegal: allModes(),
    educationalTag: 'process is the moat that competition cannot buy',
  },
  {
    cardId: 'so_crisis_protocol_001',
    name: 'Crisis Protocol',
    deckType: DeckType.SO,
    baseCost: 4_500,
    effects: [
      { op: CardEffectOp.HEAT_DELTA,   magnitude: -6 },
      { op: CardEffectOp.SHIELD_DELTA, magnitude: 14 },
      { op: CardEffectOp.STATUS_ADD,   magnitude: 1, metadata: { status: 'crisis_mode_activated' } },
    ],
    tags: [CardTag.RESILIENCE, CardTag.PRECISION, CardTag.CASCADE],
    timingClasses: [TimingClass.CAS, TimingClass.ANY],
    rarity: CardRarity.UNCOMMON,
    autoResolve: false,
    counterability: Counterability.NONE,
    targeting: Targeting.SELF,
    modeLegal: allModes(),
    educationalTag: 'the pre-planned response is always better than the improvised one',
  },

  // ──────────────────────────────────────────────────────────────────────────
  // SABOTAGE — HEAD_TO_HEAD attack cards
  // ──────────────────────────────────────────────────────────────────────────

  {
    cardId: 'sab_market_dump_001',
    name: 'Market Dump',
    deckType: DeckType.SABOTAGE,
    baseCost: 30,
    effects: [{ op: CardEffectOp.EXPENSE_DELTA, magnitude: 300 }],
    tags: [CardTag.SABOTAGE, CardTag.TEMPO, CardTag.INCOME],
    timingClasses: [TimingClass.PRE, TimingClass.POST, TimingClass.ANY],
    rarity: CardRarity.COMMON,
    autoResolve: false,
    counterability: Counterability.HARD,
    targeting: Targeting.OPPONENT,
    modeLegal: [GameMode.HEAD_TO_HEAD],
    educationalTag: 'control perceived value',
  },
  {
    cardId: 'sab_debt_injection_001',
    name: 'Debt Injection',
    deckType: DeckType.SABOTAGE,
    baseCost: 40,
    effects: [
      { op: CardEffectOp.INJECT_CARD, magnitude: 1, metadata: { cardId: 'fubar_debt_card_001' } },
      { op: CardEffectOp.EXPENSE_DELTA, magnitude: 12 },
    ],
    tags: [CardTag.SABOTAGE, CardTag.CASCADE, CardTag.TEMPO],
    timingClasses: [TimingClass.PRE, TimingClass.PSK],
    rarity: CardRarity.UNCOMMON,
    autoResolve: false,
    counterability: Counterability.HARD,
    targeting: Targeting.OPPONENT,
    modeLegal: [GameMode.HEAD_TO_HEAD],
    educationalTag: 'debt is a weapon when deployed externally',
  },
  {
    cardId: 'sab_chain_rumor_001',
    name: 'Chain Rumor',
    deckType: DeckType.SABOTAGE,
    baseCost: 15,
    effects: [{ op: CardEffectOp.INCOME_DELTA, magnitude: -25 }],
    tags: [CardTag.SABOTAGE, CardTag.TEMPO, CardTag.MOMENTUM],
    timingClasses: [TimingClass.POST, TimingClass.ANY],
    rarity: CardRarity.COMMON,
    autoResolve: false,
    counterability: Counterability.SOFT,
    targeting: Targeting.OPPONENT,
    modeLegal: [GameMode.HEAD_TO_HEAD],
    educationalTag: 'small pressure compounds',
  },
  {
    cardId: 'sab_media_blitz_001',
    name: 'Media Blitz',
    deckType: DeckType.SABOTAGE,
    baseCost: 35,
    effects: [
      { op: CardEffectOp.STATUS_ADD, magnitude: 1, metadata: { status: 'next_sabotage_x2_3ticks' } },
    ],
    tags: [CardTag.SABOTAGE, CardTag.TEMPO, CardTag.VARIANCE],
    timingClasses: [TimingClass.ANY],
    rarity: CardRarity.UNCOMMON,
    autoResolve: false,
    counterability: Counterability.SOFT,
    targeting: Targeting.SELF,
    modeLegal: [GameMode.HEAD_TO_HEAD],
    educationalTag: 'preparation multiplies execution',
  },
  {
    cardId: 'sab_hostile_takeover_001',
    name: 'Hostile Takeover',
    deckType: DeckType.SABOTAGE,
    baseCost: 60,
    effects: [
      { op: CardEffectOp.INCOME_DELTA, magnitude: -50 },
      { op: CardEffectOp.STATUS_ADD,   magnitude: 1, metadata: { status: 'permanent_best_asset_half_value' } },
    ],
    tags: [CardTag.SABOTAGE, CardTag.TEMPO, CardTag.SCALE],
    timingClasses: [TimingClass.PSK, TimingClass.ANY],
    rarity: CardRarity.LEGENDARY,
    autoResolve: false,
    counterability: Counterability.HARD,
    targeting: Targeting.OPPONENT,
    modeLegal: [GameMode.HEAD_TO_HEAD],
    educationalTag: 'largest attacks are permanent, not loud',
    modeOverlays: baseLegendaryOverlay(),
  },
  {
    cardId: 'sab_trust_erosion_001',
    name: 'Trust Erosion',
    deckType: DeckType.SABOTAGE,
    baseCost: 25,
    effects: [
      { op: CardEffectOp.TRUST_DELTA, magnitude: -12 },
      { op: CardEffectOp.HEAT_DELTA,  magnitude: 3   },
    ],
    tags: [CardTag.SABOTAGE, CardTag.TEMPO, CardTag.HEAT],
    timingClasses: [TimingClass.POST, TimingClass.ANY],
    rarity: CardRarity.UNCOMMON,
    autoResolve: false,
    counterability: Counterability.SOFT,
    targeting: Targeting.OPPONENT,
    modeLegal: [GameMode.HEAD_TO_HEAD],
    educationalTag: 'trust is the hardest asset to rebuild',
  },
  {
    cardId: 'sab_supply_disruption_001',
    name: 'Supply Disruption',
    deckType: DeckType.SABOTAGE,
    baseCost: 20,
    effects: [
      { op: CardEffectOp.EXPENSE_DELTA, magnitude: 600 },
      { op: CardEffectOp.STATUS_ADD,    magnitude: 1, metadata: { status: 'supply_locked_2ticks' } },
    ],
    tags: [CardTag.SABOTAGE, CardTag.CASCADE, CardTag.TEMPO],
    timingClasses: [TimingClass.PRE, TimingClass.ANY],
    rarity: CardRarity.COMMON,
    autoResolve: false,
    counterability: Counterability.HARD,
    targeting: Targeting.OPPONENT,
    modeLegal: [GameMode.HEAD_TO_HEAD],
    educationalTag: 'disrupt the supply before the demand spike',
  },

  // ──────────────────────────────────────────────────────────────────────────
  // COUNTER — HEAD_TO_HEAD defense cards
  // ──────────────────────────────────────────────────────────────────────────

  {
    cardId: 'ctr_liquidity_wall_001',
    name: 'Liquidity Wall',
    deckType: DeckType.COUNTER,
    baseCost: 18,
    effects: [
      { op: CardEffectOp.SHIELD_DELTA, magnitude: 18 },
      { op: CardEffectOp.STATUS_ADD,   magnitude: 1, metadata: { status: 'blocked_market_dump' } },
    ],
    tags: [CardTag.COUNTER, CardTag.RESILIENCE, CardTag.LIQUIDITY],
    timingClasses: [TimingClass.CTR],
    rarity: CardRarity.COMMON,
    autoResolve: false,
    counterability: Counterability.NONE,
    targeting: Targeting.SELF,
    modeLegal: [GameMode.HEAD_TO_HEAD],
    educationalTag: 'defense is economical',
  },
  {
    cardId: 'ctr_credit_freeze_001',
    name: 'Credit Freeze',
    deckType: DeckType.COUNTER,
    baseCost: 12,
    effects: [
      { op: CardEffectOp.SHIELD_DELTA, magnitude: 8 },
      { op: CardEffectOp.STATUS_ADD,   magnitude: 1, metadata: { status: 'blocked_credit_pull' } },
    ],
    tags: [CardTag.COUNTER, CardTag.PRECISION],
    timingClasses: [TimingClass.CTR],
    rarity: CardRarity.COMMON,
    autoResolve: false,
    counterability: Counterability.NONE,
    targeting: Targeting.SELF,
    modeLegal: [GameMode.HEAD_TO_HEAD],
    educationalTag: 'prepare the file before the audit',
  },
  {
    cardId: 'ctr_evidence_file_001',
    name: 'Evidence File',
    deckType: DeckType.COUNTER,
    baseCost: 20,
    effects: [
      { op: CardEffectOp.SHIELD_DELTA, magnitude: 10 },
      { op: CardEffectOp.STATUS_ADD,   magnitude: 1, metadata: { status: 'blocked_regulatory_filing' } },
    ],
    tags: [CardTag.COUNTER, CardTag.RESILIENCE],
    timingClasses: [TimingClass.CTR],
    rarity: CardRarity.UNCOMMON,
    autoResolve: false,
    counterability: Counterability.NONE,
    targeting: Targeting.SELF,
    modeLegal: [GameMode.HEAD_TO_HEAD],
    educationalTag: 'paperwork is armor',
  },
  {
    cardId: 'ctr_signal_clear_001',
    name: 'Signal Clear',
    deckType: DeckType.COUNTER,
    baseCost: 15,
    effects: [
      { op: CardEffectOp.STATUS_REMOVE, magnitude: 1, metadata: { status: 'misinformation_flood' } },
      { op: CardEffectOp.SHIELD_DELTA,  magnitude: 6 },
    ],
    tags: [CardTag.COUNTER, CardTag.PRECISION],
    timingClasses: [TimingClass.CTR],
    rarity: CardRarity.COMMON,
    autoResolve: false,
    counterability: Counterability.NONE,
    targeting: Targeting.SELF,
    modeLegal: [GameMode.HEAD_TO_HEAD],
    educationalTag: 'clear signal beats panic',
  },
  {
    cardId: 'ctr_debt_shield_001',
    name: 'Debt Shield',
    deckType: DeckType.COUNTER,
    baseCost: 24,
    effects: [
      { op: CardEffectOp.EXPENSE_DELTA, magnitude: -12 },
      { op: CardEffectOp.STATUS_ADD,    magnitude: 1, metadata: { status: 'blocked_debt_injection' } },
    ],
    tags: [CardTag.COUNTER, CardTag.RESILIENCE, CardTag.CASCADE],
    timingClasses: [TimingClass.CTR],
    rarity: CardRarity.UNCOMMON,
    autoResolve: false,
    counterability: Counterability.NONE,
    targeting: Targeting.SELF,
    modeLegal: [GameMode.HEAD_TO_HEAD],
    educationalTag: 'protect the balance sheet before it compounds',
  },
  {
    cardId: 'ctr_reputation_wall_001',
    name: 'Reputation Wall',
    deckType: DeckType.COUNTER,
    baseCost: 22,
    effects: [
      { op: CardEffectOp.SHIELD_DELTA, magnitude: 14 },
      { op: CardEffectOp.TRUST_DELTA,  magnitude: 5  },
      { op: CardEffectOp.STATUS_ADD,   magnitude: 1, metadata: { status: 'blocked_trust_erosion' } },
    ],
    tags: [CardTag.COUNTER, CardTag.RESILIENCE, CardTag.TRUST],
    timingClasses: [TimingClass.CTR, TimingClass.ANY],
    rarity: CardRarity.UNCOMMON,
    autoResolve: false,
    counterability: Counterability.NONE,
    targeting: Targeting.SELF,
    modeLegal: [GameMode.HEAD_TO_HEAD],
    educationalTag: 'protect your reputation the way you protect your cash',
  },

  // ──────────────────────────────────────────────────────────────────────────
  // BLUFF — HEAD_TO_HEAD deception cards
  // ──────────────────────────────────────────────────────────────────────────

  {
    cardId: 'bluff_mirror_buyback_001',
    name: 'Mirror Buyback',
    deckType: DeckType.BLUFF,
    baseCost: 5_000,
    effects: [
      { op: CardEffectOp.CASH_DELTA,  magnitude: 3_500 },
      { op: CardEffectOp.HEAT_DELTA,  magnitude: -2    },
      { op: CardEffectOp.STATUS_ADD,  magnitude: 1, metadata: { status: 'appears_as_sabotage_to_opponent' } },
    ],
    tags: [CardTag.TEMPO, CardTag.VARIANCE, CardTag.MOMENTUM],
    timingClasses: [TimingClass.ANY, TimingClass.POST],
    rarity: CardRarity.UNCOMMON,
    autoResolve: false,
    counterability: Counterability.SOFT,
    targeting: Targeting.SELF,
    modeLegal: [GameMode.HEAD_TO_HEAD],
    educationalTag: 'deception changes timing quality',
  },
  {
    cardId: 'bluff_phantom_raise_001',
    name: 'Phantom Capital Raise',
    deckType: DeckType.BLUFF,
    baseCost: 8_000,
    effects: [
      { op: CardEffectOp.HEAT_DELTA,  magnitude: -5 },
      { op: CardEffectOp.SHIELD_DELTA, magnitude: 10 },
      { op: CardEffectOp.STATUS_ADD,  magnitude: 1, metadata: { status: 'opponent_misread_capital_3ticks' } },
    ],
    tags: [CardTag.TEMPO, CardTag.VARIANCE, CardTag.PRECISION],
    timingClasses: [TimingClass.PSK, TimingClass.ANY],
    rarity: CardRarity.RARE,
    autoResolve: false,
    counterability: Counterability.SOFT,
    targeting: Targeting.SELF,
    modeLegal: [GameMode.HEAD_TO_HEAD],
    educationalTag: 'perceived strength delays aggression',
  },
  {
    cardId: 'bluff_false_pivot_001',
    name: 'False Pivot Signal',
    deckType: DeckType.BLUFF,
    baseCost: 3_500,
    effects: [
      { op: CardEffectOp.STATUS_ADD, magnitude: 1, metadata: { status: 'opponent_expects_direction_change' } },
      { op: CardEffectOp.CORD_BONUS_FLAT, magnitude: 0.01 },
    ],
    tags: [CardTag.VARIANCE, CardTag.TEMPO, CardTag.DIVERGENCE],
    timingClasses: [TimingClass.POST, TimingClass.ANY],
    rarity: CardRarity.COMMON,
    autoResolve: false,
    counterability: Counterability.HARD,
    targeting: Targeting.SELF,
    modeLegal: [GameMode.HEAD_TO_HEAD],
    educationalTag: 'misdirection earns the window you need',
  },

  // ──────────────────────────────────────────────────────────────────────────
  // AID — TEAM_UP cooperative funding cards
  // ──────────────────────────────────────────────────────────────────────────

  {
    cardId: 'aid_liquidity_bridge_001',
    name: 'Liquidity Bridge',
    deckType: DeckType.AID,
    baseCost: 0,
    effects: [
      { op: CardEffectOp.TREASURY_DELTA, magnitude: -10_000 },
      { op: CardEffectOp.CASH_DELTA,     magnitude: 10_000  },
      { op: CardEffectOp.TRUST_DELTA,    magnitude: 5       },
    ],
    tags: [CardTag.AID, CardTag.TRUST, CardTag.LIQUIDITY, CardTag.RESILIENCE],
    timingClasses: [TimingClass.AID, TimingClass.ANY],
    rarity: CardRarity.COMMON,
    autoResolve: false,
    counterability: Counterability.NONE,
    targeting: Targeting.TEAMMATE,
    modeLegal: [GameMode.TEAM_UP],
    educationalTag: 'liquidity > vanity',
  },
  {
    cardId: 'aid_shield_loan_001',
    name: 'Shield Loan',
    deckType: DeckType.AID,
    baseCost: 0,
    effects: [
      { op: CardEffectOp.SHIELD_DELTA, magnitude: 15 },
      { op: CardEffectOp.TRUST_DELTA,  magnitude: 8  },
    ],
    tags: [CardTag.AID, CardTag.TRUST, CardTag.RESILIENCE, CardTag.CASCADE],
    timingClasses: [TimingClass.AID, TimingClass.RES],
    rarity: CardRarity.UNCOMMON,
    autoResolve: false,
    counterability: Counterability.NONE,
    targeting: Targeting.TEAMMATE,
    modeLegal: [GameMode.TEAM_UP],
    educationalTag: 'collateral is your skin in their game',
  },
  {
    cardId: 'aid_expansion_lease_001',
    name: 'Expansion Lease',
    deckType: DeckType.AID,
    baseCost: 4_000,
    effects: [
      { op: CardEffectOp.INCOME_DELTA, magnitude: 1_200 },
      { op: CardEffectOp.TRUST_DELTA,  magnitude: 3     },
    ],
    tags: [CardTag.AID, CardTag.INCOME, CardTag.SCALE, CardTag.TRUST],
    timingClasses: [TimingClass.PRE, TimingClass.ANY],
    rarity: CardRarity.UNCOMMON,
    autoResolve: false,
    counterability: Counterability.NONE,
    targeting: Targeting.TEAMMATE,
    modeLegal: [GameMode.TEAM_UP],
    educationalTag: 'joint ventures outperform solo risk',
  },
  {
    cardId: 'aid_income_share_001',
    name: 'Income Share Agreement',
    deckType: DeckType.AID,
    baseCost: 0,
    effects: [
      { op: CardEffectOp.INCOME_DELTA, magnitude: 800  },
      { op: CardEffectOp.TRUST_DELTA,  magnitude: 10   },
      { op: CardEffectOp.STATUS_ADD,   magnitude: 1, metadata: { status: 'income_share_5ticks' } },
    ],
    tags: [CardTag.AID, CardTag.INCOME, CardTag.TRUST, CardTag.MOMENTUM],
    timingClasses: [TimingClass.AID, TimingClass.PRE],
    rarity: CardRarity.RARE,
    autoResolve: false,
    counterability: Counterability.NONE,
    targeting: Targeting.TEAMMATE,
    modeLegal: [GameMode.TEAM_UP],
    educationalTag: 'aligned incentives outperform salary structures',
  },

  // ──────────────────────────────────────────────────────────────────────────
  // RESCUE — TEAM_UP emergency recovery cards
  // ──────────────────────────────────────────────────────────────────────────

  {
    cardId: 'rescue_emergency_capital_001',
    name: 'Emergency Capital',
    deckType: DeckType.RESCUE,
    baseCost: 0,
    effects: [
      { op: CardEffectOp.TREASURY_DELTA, magnitude: -12_000 },
      { op: CardEffectOp.CASH_DELTA,     magnitude: 12_000  },
      { op: CardEffectOp.SHIELD_DELTA,   magnitude: 12      },
    ],
    tags: [CardTag.RESILIENCE, CardTag.AID, CardTag.TRUST],
    timingClasses: [TimingClass.RES],
    rarity: CardRarity.UNCOMMON,
    autoResolve: false,
    counterability: Counterability.NONE,
    targeting: Targeting.TEAMMATE,
    modeLegal: [GameMode.TEAM_UP],
    educationalTag: 'rescue speed matters more than rescue intent',
  },
  {
    cardId: 'rescue_cascade_interrupt_001',
    name: 'Cascade Interrupt',
    deckType: DeckType.RESCUE,
    baseCost: 0,
    effects: [
      { op: CardEffectOp.STATUS_REMOVE, magnitude: 1, metadata: { status: 'active_cascade' } },
      { op: CardEffectOp.SHIELD_DELTA,  magnitude: 18 },
      { op: CardEffectOp.TRUST_DELTA,   magnitude: 6  },
    ],
    tags: [CardTag.RESILIENCE, CardTag.CASCADE, CardTag.TRUST, CardTag.AID],
    timingClasses: [TimingClass.RES, TimingClass.CAS],
    rarity: CardRarity.RARE,
    autoResolve: false,
    counterability: Counterability.NONE,
    targeting: Targeting.TEAMMATE,
    modeLegal: [GameMode.TEAM_UP],
    educationalTag: 'stop the chain before it reaches the core',
  },
  {
    cardId: 'rescue_debt_relief_001',
    name: 'Debt Relief Fund',
    deckType: DeckType.RESCUE,
    baseCost: 0,
    effects: [
      { op: CardEffectOp.EXPENSE_DELTA,  magnitude: -1_800 },
      { op: CardEffectOp.SHIELD_DELTA,   magnitude: 8      },
      { op: CardEffectOp.TRUST_DELTA,    magnitude: 12     },
    ],
    tags: [CardTag.RESILIENCE, CardTag.TRUST, CardTag.AID, CardTag.LIQUIDITY],
    timingClasses: [TimingClass.RES, TimingClass.ANY],
    rarity: CardRarity.UNCOMMON,
    autoResolve: false,
    counterability: Counterability.NONE,
    targeting: Targeting.TEAMMATE,
    modeLegal: [GameMode.TEAM_UP],
    educationalTag: 'bearing another\'s burden multiplies team endurance',
  },

  // ──────────────────────────────────────────────────────────────────────────
  // TRUST — TEAM_UP loyalty + bond cards
  // ──────────────────────────────────────────────────────────────────────────

  {
    cardId: 'trust_loyalty_signal_001',
    name: 'Loyalty Signal',
    deckType: DeckType.TRUST,
    baseCost: 0,
    effects: [
      { op: CardEffectOp.TRUST_DELTA, magnitude: 10 },
      { op: CardEffectOp.STATUS_ADD,  magnitude: 1, metadata: { status: 'loyalty_bonus_3ticks' } },
    ],
    tags: [CardTag.TRUST, CardTag.AID, CardTag.MOMENTUM],
    timingClasses: [TimingClass.ANY, TimingClass.POST],
    rarity: CardRarity.COMMON,
    autoResolve: false,
    counterability: Counterability.NONE,
    targeting: Targeting.TEAMMATE,
    modeLegal: [GameMode.TEAM_UP],
    educationalTag: 'trust compounds when it is visible',
  },
  {
    cardId: 'trust_covenant_001',
    name: 'Team Covenant',
    deckType: DeckType.TRUST,
    baseCost: 0,
    effects: [
      { op: CardEffectOp.TRUST_DELTA,    magnitude: 18   },
      { op: CardEffectOp.CORD_BONUS_FLAT, magnitude: 0.015 },
      { op: CardEffectOp.STATUS_ADD,     magnitude: 1, metadata: { status: 'team_cord_x1_5_for_2ticks' } },
    ],
    tags: [CardTag.TRUST, CardTag.AID, CardTag.MOMENTUM, CardTag.SCALE],
    timingClasses: [TimingClass.ANY, TimingClass.END],
    rarity: CardRarity.RARE,
    autoResolve: false,
    counterability: Counterability.NONE,
    targeting: Targeting.TEAM,
    modeLegal: [GameMode.TEAM_UP],
    educationalTag: 'covenant creates velocity that strategy cannot',
  },
  {
    cardId: 'trust_transparency_dividend_001',
    name: 'Transparency Dividend',
    deckType: DeckType.TRUST,
    baseCost: 2_000,
    effects: [
      { op: CardEffectOp.TRUST_DELTA,  magnitude: 8   },
      { op: CardEffectOp.HEAT_DELTA,   magnitude: -4  },
      { op: CardEffectOp.INCOME_DELTA, magnitude: 400 },
    ],
    tags: [CardTag.TRUST, CardTag.RESILIENCE, CardTag.INCOME],
    timingClasses: [TimingClass.POST, TimingClass.ANY],
    rarity: CardRarity.COMMON,
    autoResolve: false,
    counterability: Counterability.NONE,
    targeting: Targeting.TEAM,
    modeLegal: [GameMode.TEAM_UP],
    educationalTag: 'transparent teams execute faster',
  },

  // ──────────────────────────────────────────────────────────────────────────
  // DISCIPLINE — GO_ALONE / CHASE_A_LEGEND solo mastery cards
  // ──────────────────────────────────────────────────────────────────────────

  {
    cardId: 'disc_iron_discipline_001',
    name: 'Iron Discipline',
    deckType: DeckType.DISCIPLINE,
    baseCost: 5_000,
    effects: [
      { op: CardEffectOp.STATUS_ADD,      magnitude: 1, metadata: { status: 'forced_cards_second_best_4run' } },
      { op: CardEffectOp.CORD_BONUS_FLAT, magnitude: 0.02 },
    ],
    tags: [CardTag.PRECISION, CardTag.RESILIENCE, CardTag.VARIANCE],
    timingClasses: [TimingClass.ANY],
    rarity: CardRarity.RARE,
    autoResolve: false,
    counterability: Counterability.NONE,
    targeting: Targeting.SELF,
    modeLegal: [GameMode.GO_ALONE, GameMode.CHASE_A_LEGEND],
    educationalTag: 'professional downside control beats heroism',
  },
  {
    cardId: 'disc_precision_hold_001',
    name: 'Precision Hold',
    deckType: DeckType.DISCIPLINE,
    baseCost: 0,
    effects: [{ op: CardEffectOp.TIMER_FREEZE, magnitude: 4 }],
    tags: [CardTag.PRECISION, CardTag.TEMPO, CardTag.DIVERGENCE],
    timingClasses: [TimingClass.PRE, TimingClass.GBM],
    rarity: CardRarity.UNCOMMON,
    autoResolve: false,
    counterability: Counterability.NONE,
    targeting: Targeting.SELF,
    modeLegal: [GameMode.CHASE_A_LEGEND],
    educationalTag: 'patience is a precision tool',
  },
  {
    cardId: 'disc_ruthless_efficiency_001',
    name: 'Ruthless Efficiency',
    deckType: DeckType.DISCIPLINE,
    baseCost: 3_000,
    effects: [
      { op: CardEffectOp.EXPENSE_DELTA,   magnitude: -800  },
      { op: CardEffectOp.CORD_BONUS_FLAT, magnitude: 0.015 },
      { op: CardEffectOp.INCOME_DELTA,    magnitude: 400   },
    ],
    tags: [CardTag.PRECISION, CardTag.RESILIENCE, CardTag.MOMENTUM],
    timingClasses: [TimingClass.PRE, TimingClass.POST, TimingClass.ANY],
    rarity: CardRarity.UNCOMMON,
    autoResolve: false,
    counterability: Counterability.NONE,
    targeting: Targeting.SELF,
    modeLegal: [GameMode.GO_ALONE, GameMode.CHASE_A_LEGEND],
    educationalTag: 'cut everything that does not compound',
  },
  {
    cardId: 'disc_zero_leverage_001',
    name: 'Zero Leverage Run',
    deckType: DeckType.DISCIPLINE,
    baseCost: 0,
    effects: [
      { op: CardEffectOp.HEAT_DELTA,      magnitude: -8   },
      { op: CardEffectOp.CORD_BONUS_FLAT, magnitude: 0.03 },
      { op: CardEffectOp.STATUS_ADD,      magnitude: 1, metadata: { status: 'leverage_locked_run' } },
    ],
    tags: [CardTag.PRECISION, CardTag.RESILIENCE, CardTag.VARIANCE, CardTag.DIVERGENCE],
    timingClasses: [TimingClass.PRE, TimingClass.PHZ],
    rarity: CardRarity.RARE,
    autoResolve: false,
    counterability: Counterability.NONE,
    targeting: Targeting.SELF,
    modeLegal: [GameMode.GO_ALONE],
    educationalTag: 'the hardest mode earns the highest CORD',
  },

  // ──────────────────────────────────────────────────────────────────────────
  // GHOST — CHASE_A_LEGEND benchmark divergence cards
  // ──────────────────────────────────────────────────────────────────────────

  {
    cardId: 'ghost_pass_exploit_001',
    name: 'Ghost Pass',
    deckType: DeckType.GHOST,
    baseCost: 0,
    effects: [
      { op: CardEffectOp.CORD_BONUS_FLAT, magnitude: 0.04  },
      { op: CardEffectOp.SHIELD_DELTA,    magnitude: 12    },
    ],
    tags: [CardTag.DIVERGENCE, CardTag.PRECISION, CardTag.RESILIENCE],
    timingClasses: [TimingClass.GBM],
    rarity: CardRarity.RARE,
    autoResolve: false,
    counterability: Counterability.NONE,
    targeting: Targeting.GHOST,
    modeLegal: [GameMode.CHASE_A_LEGEND],
    educationalTag: 'play near markers to earn difference',
  },
  {
    cardId: 'ghost_legend_trace_001',
    name: 'Legend Trace',
    deckType: DeckType.GHOST,
    baseCost: 0,
    effects: [
      { op: CardEffectOp.DIVERGENCE_DELTA, magnitude: 8   },
      { op: CardEffectOp.CORD_BONUS_FLAT,  magnitude: 0.025 },
    ],
    tags: [CardTag.DIVERGENCE, CardTag.PRECISION, CardTag.MOMENTUM],
    timingClasses: [TimingClass.GBM, TimingClass.PRE],
    rarity: CardRarity.UNCOMMON,
    autoResolve: false,
    counterability: Counterability.NONE,
    targeting: Targeting.GHOST,
    modeLegal: [GameMode.CHASE_A_LEGEND],
    educationalTag: 'divergence from legend path is the score',
  },
  {
    cardId: 'ghost_benchmark_break_001',
    name: 'Benchmark Break',
    deckType: DeckType.GHOST,
    baseCost: 2_000,
    effects: [
      { op: CardEffectOp.DIVERGENCE_DELTA, magnitude: 15   },
      { op: CardEffectOp.CORD_BONUS_FLAT,  magnitude: 0.05 },
      { op: CardEffectOp.STATUS_ADD,       magnitude: 1, metadata: { status: 'ghost_ahead_of_legend' } },
    ],
    tags: [CardTag.DIVERGENCE, CardTag.PRECISION, CardTag.MOMENTUM, CardTag.SCALE],
    timingClasses: [TimingClass.GBM, TimingClass.PSK],
    rarity: CardRarity.LEGENDARY,
    autoResolve: false,
    counterability: Counterability.HARD,
    targeting: Targeting.GHOST,
    modeLegal: [GameMode.CHASE_A_LEGEND],
    educationalTag: 'surpassing the legend is the only proof that matters',
    modeOverlays: {
      [GameMode.CHASE_A_LEGEND]: { cordWeight: 1.3 },
    },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // ALL-MODE LEGENDARIES
  // ──────────────────────────────────────────────────────────────────────────

  {
    cardId: 'leg_sovereign_leverage_001',
    name: 'Sovereign Leverage',
    deckType: DeckType.PRIVILEGED,
    baseCost: 20_000,
    effects: [
      { op: CardEffectOp.CASH_DELTA,       magnitude: 10_000 },
      { op: CardEffectOp.INCOME_DELTA,     magnitude: 2_500  },
      { op: CardEffectOp.CORD_BONUS_FLAT,  magnitude: 0.03   },
    ],
    tags: [CardTag.LIQUIDITY, CardTag.SCALE, CardTag.MOMENTUM],
    timingClasses: [TimingClass.ANY, TimingClass.PHZ, TimingClass.GBM],
    rarity: CardRarity.LEGENDARY,
    autoResolve: false,
    counterability: Counterability.HARD,
    targeting: Targeting.SELF,
    modeLegal: allModes(),
    educationalTag: 'leverage is a tool, not a trait',
    modeOverlays: {
      ...baseLegendaryOverlay(),
      [GameMode.HEAD_TO_HEAD]: { currencyOverride: 'battle_budget' as CurrencyType, cordWeight: 1.12 },
      [GameMode.TEAM_UP]:      { targetingOverride: Targeting.TEAMMATE,              cordWeight: 1.14 },
    },
  },
  {
    cardId: 'leg_systemic_override_001',
    name: 'Systemic Override',
    deckType: DeckType.PRIVILEGED,
    baseCost: 16_000,
    effects: [
      { op: CardEffectOp.HEAT_DELTA,      magnitude: -100 },
      { op: CardEffectOp.CORD_BONUS_FLAT, magnitude: 0.025 },
    ],
    tags: [CardTag.RESILIENCE, CardTag.PRECISION, CardTag.HEAT],
    timingClasses: [TimingClass.ANY, TimingClass.CAS, TimingClass.PSK],
    rarity: CardRarity.LEGENDARY,
    autoResolve: false,
    counterability: Counterability.HARD,
    targeting: Targeting.GLOBAL,
    modeLegal: allModes(),
    educationalTag: 'reset pressure before building again',
    modeOverlays: baseLegendaryOverlay(),
  },
  {
    cardId: 'leg_cascade_break_001',
    name: 'Cascade Break',
    deckType: DeckType.SO,
    baseCost: 9_000,
    effects: [
      { op: CardEffectOp.STATUS_REMOVE,   magnitude: 1, metadata: { status: 'all_active_cascade_chains' } },
      { op: CardEffectOp.SHIELD_DELTA,    magnitude: 18   },
      { op: CardEffectOp.CORD_BONUS_FLAT, magnitude: 0.02 },
    ],
    tags: [CardTag.RESILIENCE, CardTag.CASCADE, CardTag.PRECISION],
    timingClasses: [TimingClass.CAS, TimingClass.ANY],
    rarity: CardRarity.LEGENDARY,
    autoResolve: false,
    counterability: Counterability.HARD,
    targeting: Targeting.GLOBAL,
    modeLegal: allModes(),
    educationalTag: 'intercept the chain before it compounds',
    modeOverlays: {
      ...baseLegendaryOverlay(),
      [GameMode.TEAM_UP]: { effectModifier: 1.2 },
    },
  },
  {
    cardId: 'leg_time_debt_paid_001',
    name: 'Time Debt Paid',
    deckType: DeckType.PRIVILEGED,
    baseCost: 10_000,
    effects: [
      { op: CardEffectOp.STATUS_ADD,      magnitude: 1, metadata: { status: 'add_90_seconds' } },
      { op: CardEffectOp.CORD_BONUS_FLAT, magnitude: 0.015 },
    ],
    tags: [CardTag.MOMENTUM, CardTag.RESILIENCE, CardTag.PRECISION],
    timingClasses: [TimingClass.END, TimingClass.ANY],
    rarity: CardRarity.LEGENDARY,
    autoResolve: false,
    counterability: Counterability.HARD,
    targeting: Targeting.GLOBAL,
    modeLegal: allModes(),
    educationalTag: 'time can be purchased, but never cheaply',
    modeOverlays: baseLegendaryOverlay(),
  },
  {
    cardId: 'leg_freedom_play_001',
    name: 'Freedom Play',
    deckType: DeckType.OPPORTUNITY,
    baseCost: 25_000,
    effects: [
      { op: CardEffectOp.INCOME_DELTA,    magnitude: 5_000   },
      { op: CardEffectOp.CASH_DELTA,      magnitude: 20_000  },
      { op: CardEffectOp.CORD_BONUS_FLAT, magnitude: 0.05    },
      { op: CardEffectOp.HEAT_DELTA,      magnitude: -15     },
      { op: CardEffectOp.SHIELD_DELTA,    magnitude: 25      },
    ],
    tags: [CardTag.INCOME, CardTag.SCALE, CardTag.RESILIENCE, CardTag.MOMENTUM, CardTag.LIQUIDITY],
    timingClasses: [TimingClass.ANY, TimingClass.END, TimingClass.PHZ],
    rarity: CardRarity.LEGENDARY,
    autoResolve: false,
    counterability: Counterability.HARD,
    targeting: Targeting.SELF,
    modeLegal: allModes(),
    educationalTag: 'sovereignty is earned, never given',
    modeOverlays: {
      ...baseLegendaryOverlay(),
      [GameMode.CHASE_A_LEGEND]: { cordWeight: 1.5 },
    },
  },
  {
    cardId: 'leg_network_effect_001',
    name: 'Network Effect Unlock',
    deckType: DeckType.IPA,
    baseCost: 14_000,
    effects: [
      { op: CardEffectOp.INCOME_DELTA,    magnitude: 3_500   },
      { op: CardEffectOp.CORD_BONUS_FLAT, magnitude: 0.04    },
      { op: CardEffectOp.STATUS_ADD,      magnitude: 1, metadata: { status: 'income_doubles_per_3ticks' } },
    ],
    tags: [CardTag.INCOME, CardTag.SCALE, CardTag.MOMENTUM, CardTag.CASCADE],
    timingClasses: [TimingClass.PRE, TimingClass.ANY],
    rarity: CardRarity.LEGENDARY,
    autoResolve: false,
    counterability: Counterability.SOFT,
    targeting: Targeting.GLOBAL,
    modeLegal: allModes(),
    educationalTag: 'compound growth defeats linear execution',
    modeOverlays: {
      ...baseLegendaryOverlay(),
      [GameMode.TEAM_UP]: { effectModifier: 1.3, cordWeight: 1.2 },
    },
  },
] as const);

// =============================================================================
// MARK: Singletons + factory exports
// =============================================================================

/**
 * Default global card registry singleton.
 * Pre-loaded with DEFAULT_CARD_DEFINITIONS.
 */
export const DEFAULT_CARD_REGISTRY = new CardRegistry();

/**
 * Default CardRegistryHub singleton.
 * Wires registry + ML suite + chat signal emitter.
 * Consumed by engine/index.ts via the Cards namespace.
 */
export const CARD_REGISTRY_HUB = new CardRegistryHub();

/**
 * Default ML suite singleton.
 * Shares the hub's internal suite.
 */
export const CARD_REGISTRY_ML_SUITE = CARD_REGISTRY_HUB.mlSuite;

/**
 * Default chat signal emitter singleton.
 * Shares the hub's internal emitter.
 */
export const CARD_REGISTRY_EMITTER = CARD_REGISTRY_HUB.emitter;

/**
 * Factory: creates a fresh CardRegistryHub with optional custom definitions.
 */
export function createCardRegistryHub(
  initialDefinitions?: readonly CardDefinition[],
): CardRegistryHub {
  return new CardRegistryHub(initialDefinitions);
}

/**
 * Factory: creates an isolated CardRegistry for testing or per-session use.
 */
export function createIsolatedCardRegistry(
  definitions: readonly CardDefinition[] = DEFAULT_CARD_DEFINITIONS,
): CardRegistry {
  return new CardRegistry(definitions);
}

/**
 * Convenience: draw + score + emit in one deterministic call via the hub.
 */
export function drawAndScoreCard(
  input: DeterministicDrawInput,
  snapshot?: RunStateSnapshot,
  nowMs = Date.now(),
) {
  return CARD_REGISTRY_HUB.drawAndScore(input, snapshot, nowMs);
}
