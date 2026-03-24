/*
 * POINT ZERO ONE — BACKEND ENGINE CORE
 * /backend/src/game/engine/cards/CardOverlayResolver.ts
 *
 * Doctrine:
 * - backend owns final card instance materialization
 * - mode overlays must be normalized through backend primitives
 * - weighted tags are metadata, not substitute legality
 * - card instance construction must stay deterministic for replay / proof
 * - the same base card must feel materially different across Empire, Predator,
 *   Syndicate, and Phantom without violating canonical contracts
 * - resolver depth should enrich runtime identity, scoring metadata, audit
 *   surfaces, and replay fingerprints without mutating shared primitives
 */

import type {
  CardDefinition,
  CardInstance,
  DivergencePotential,
  ModeCode,
  Targeting,
  TimingClass,
} from '../core/GamePrimitives';
import {
  createCardInstance,
  resolveModeOverlay,
} from '../core/GamePrimitives';
import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import { createDeterministicId } from '../core/Deterministic';
import { MODE_TAG_WEIGHTS } from './types';

const COST_MODIFIER_MIN = 0;
const COST_MODIFIER_MAX = 10;
const EFFECT_MODIFIER_MIN = 0;
const EFFECT_MODIFIER_MAX = 10;

const FLOAT_PRECISION_4 = 10_000;
const FLOAT_PRECISION_3 = 1_000;
const COST_DECIMAL_PRECISION = 3;

const MAX_TAGS = 256;
const MAX_METADATA_TAGS = 192;
const MAX_TRACE_COMPONENTS = 96;
const MAX_DETERMINISTIC_PARTS = 80;

const DEFAULT_TAG_WEIGHT = 1;
const DEFAULT_FREEDOM_TARGET = 1;
const DEFAULT_BATTLE_BUDGET_CAP = 1;
const DEFAULT_SHARED_TREASURY_BALANCE = 1;
const DEFAULT_DRAW_PILE_SIZE = 1;
const DEFAULT_DECK_ENTROPY = 1;
const DEFAULT_HEAT_MODIFIER = 1;

const PRESSURE_LOW_THRESHOLD = 0.2;
const PRESSURE_MEDIUM_THRESHOLD = 0.45;
const PRESSURE_HIGH_THRESHOLD = 0.7;
const PRESSURE_CRITICAL_THRESHOLD = 0.9;

const TENSION_LOW_THRESHOLD = 0.2;
const TENSION_MEDIUM_THRESHOLD = 0.45;
const TENSION_HIGH_THRESHOLD = 0.7;
const TENSION_CRITICAL_THRESHOLD = 0.9;

const HEAT_LOW_THRESHOLD = 20;
const HEAT_MEDIUM_THRESHOLD = 45;
const HEAT_HIGH_THRESHOLD = 70;
const HEAT_CRITICAL_THRESHOLD = 90;

const SHIELD_SAFE_THRESHOLD = 0.85;
const SHIELD_WATCH_THRESHOLD = 0.65;
const SHIELD_RISK_THRESHOLD = 0.4;
const SHIELD_BREAKPOINT_THRESHOLD = 0.2;

const TRUST_BROKEN_THRESHOLD = 20;
const TRUST_LOW_THRESHOLD = 40;
const TRUST_STABLE_THRESHOLD = 65;
const TRUST_HIGH_THRESHOLD = 85;

const THREAT_LOW_THRESHOLD = 0.25;
const THREAT_MEDIUM_THRESHOLD = 0.5;
const THREAT_HIGH_THRESHOLD = 0.75;

const PHASE_BOUNDARY_HIGH_URGENCY = 1;
const PHASE_BOUNDARY_MEDIUM_URGENCY = 2;
const PHASE_BOUNDARY_LOW_URGENCY = 4;

const SOLO_OPPORTUNITY_FACTOR = 1.18;
const SOLO_IPA_FACTOR = 1.14;
const SOLO_PRIVILEGED_FACTOR = 1.08;
const SOLO_SO_FACTOR = 1.1;
const SOLO_FUBAR_FACTOR = 0.92;

const PVP_SABOTAGE_FACTOR = 1.26;
const PVP_COUNTER_FACTOR = 1.18;
const PVP_BLUFF_FACTOR = 1.22;
const PVP_BUILD_FACTOR = 0.88;

const COOP_AID_FACTOR = 1.18;
const COOP_RESCUE_FACTOR = 1.26;
const COOP_TRUST_FACTOR = 1.2;
const COOP_SHARED_OBJECTIVE_FACTOR = 1.12;

const GHOST_GHOST_FACTOR = 1.28;
const GHOST_DISCIPLINE_FACTOR = 1.18;
const GHOST_PRECISION_FACTOR = 1.14;

const LEGENDARY_DIVERGENCE_BONUS = 0.24;
const RARE_DIVERGENCE_BONUS = 0.12;
const UNCOMMON_DIVERGENCE_BONUS = 0.06;

const EXPLICIT_DIVERGENCE_HIGH = 0.08;
const EXPLICIT_DIVERGENCE_MEDIUM = 0.04;
const EXPLICIT_DIVERGENCE_LOW = 0.01;

const DECAY_COUNTER_WINDOW = 1;
const DECAY_RESCUE_WINDOW = 1;
const DECAY_GHOST_WINDOW = 2;
const DECAY_HOLD_WINDOW = 2;
const DECAY_PHASE_WINDOW_FLOOR = 1;

const TIMING_CLASS_ORDER: readonly TimingClass[] = Object.freeze([
  'PRE',
  'POST',
  'FATE',
  'CTR',
  'RES',
  'AID',
  'GBM',
  'CAS',
  'PHZ',
  'PSK',
  'END',
  'ANY',
]);

type NumericBand =
  | 'ZERO'
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'CRITICAL';

type ShieldBand =
  | 'FORTIFIED'
  | 'STABLE'
  | 'WATCH'
  | 'RISK'
  | 'BREAKPOINT';

type TrustBand =
  | 'BROKEN'
  | 'LOW'
  | 'STABLE'
  | 'HIGH'
  | 'LOCKED';

type PhaseBoundaryBand =
  | 'NONE'
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH';

type DoctrineRole =
  | 'ECONOMIC_ENGINE'
  | 'TEMPO_ATTACK'
  | 'COUNTER_WINDOW'
  | 'COOP_CONTRACT'
  | 'COOP_RESCUE'
  | 'PRECISION_GHOST'
  | 'VARIANCE_DISCIPLINE'
  | 'PHASE_BOUNDARY'
  | 'HEAT_RISK'
  | 'SYSTEM_CONVERSION'
  | 'GENERALIST';

type DivergenceAxis =
  | 'EXPLICIT'
  | 'RARITY'
  | 'TAG'
  | 'MODE'
  | 'PHASE'
  | 'PRESSURE'
  | 'TENSION'
  | 'GHOST'
  | 'PRECISION'
  | 'VARIANCE'
  | 'REPETITION'
  | 'AUDIT';

interface WeightedTagContribution {
  readonly tag: string;
  readonly baseWeight: number;
  readonly modeWeight: number;
  readonly overlayWeight: number;
  readonly finalWeight: number;
}

interface DoctrineEffectSummary {
  readonly cashDelta: number;
  readonly debtDelta: number;
  readonly incomeDelta: number;
  readonly expenseDelta: number;
  readonly shieldDelta: number;
  readonly heatDelta: number;
  readonly trustDelta: number;
  readonly treasuryDelta: number;
  readonly battleBudgetDelta: number;
  readonly holdChargeDelta: number;
  readonly counterIntelDelta: number;
  readonly timeDeltaMs: number;
  readonly divergenceDelta: number;
  readonly cascadeTag: string | null;
  readonly injectCardsCount: number;
  readonly exhaustCardsCount: number;
  readonly grantBadgesCount: number;
  readonly namedActionId: string | null;
}

interface OverlayTraceComponent {
  readonly key: string;
  readonly value: string | number | boolean | null;
}

interface SnapshotContext {
  readonly mode: ModeCode;
  readonly tick: number;
  readonly phase: string;
  readonly outcomePresent: boolean;

  readonly cash: number;
  readonly debt: number;
  readonly incomePerTick: number;
  readonly expensesPerTick: number;
  readonly netWorth: number;
  readonly freedomTarget: number;
  readonly cashRatioToFreedom: number;
  readonly debtRatioToFreedom: number;
  readonly netWorthRatioToFreedom: number;

  readonly pressureScore: number;
  readonly pressureBand: NumericBand;
  readonly pressureTier: string;
  readonly survivedHighPressureTicks: number;

  readonly tensionScore: number;
  readonly tensionBand: NumericBand;
  readonly visibleThreatCount: number;
  readonly threatDensity: number;
  readonly maxPulseTriggered: boolean;

  readonly shieldAverageRatio: number;
  readonly shieldBand: ShieldBand;
  readonly weakestLayerId: string;
  readonly weakestLayerRatio: number;
  readonly weakestLayerCurrent: number;
  readonly weakestLayerMax: number;
  readonly breachCount: number;

  readonly battleBudget: number;
  readonly battleBudgetCap: number;
  readonly battleBudgetRatio: number;
  readonly neutralizedBotCount: number;
  readonly activeBotCount: number;
  readonly pendingAttackCount: number;
  readonly extractionCooldownTicks: number;
  readonly extractionActionsRemaining: number;
  readonly firstBloodClaimed: boolean;
  readonly sharedOpportunityDeckCursor: number;
  readonly rivalryHeatCarry: number;

  readonly activeCascadeCount: number;
  readonly brokenChainCount: number;
  readonly completedChainCount: number;
  readonly cascadeDensity: number;
  readonly repeatedTriggerDistinctCount: number;

  readonly sovereigntyScore: number;
  readonly gapVsLegend: number;
  readonly gapClosingRate: number;
  readonly proofBadgeCount: number;
  readonly auditFlagCount: number;

  readonly drawPileSize: number;
  readonly deckEntropy: number;
  readonly handSize: number;
  readonly discardSize: number;
  readonly exhaustSize: number;
  readonly drawHistorySize: number;
  readonly lastPlayedSize: number;
  readonly ghostMarkerCount: number;

  readonly holdEnabled: boolean;
  readonly holdCharges: number;
  readonly activeDecisionWindowCount: number;
  readonly frozenWindowCount: number;
  readonly seasonBudgetMs: number;
  readonly extensionBudgetMs: number;
  readonly elapsedMs: number;
  readonly currentTickDurationMs: number;

  readonly trustSelf: number;
  readonly trustBand: TrustBand;
  readonly roleAssignedToSelf: string | null;
  readonly defectionStepForSelf: number;
  readonly sharedTreasury: boolean;
  readonly sharedTreasuryBalance: number;
  readonly sharedTreasuryRatio: number;
  readonly legendMarkersEnabled: boolean;
  readonly communityHeatModifier: number;
  readonly sharedOpportunityDeck: boolean;
  readonly counterIntelTier: number;
  readonly spectatorLimit: number;
  readonly phaseBoundaryWindowsRemaining: number;
  readonly phaseBoundaryBand: PhaseBoundaryBand;
  readonly bleedMode: boolean;
  readonly handicapCount: number;
  readonly advantageId: string | null;
  readonly disabledBotCount: number;
  readonly modePresentation: string;
  readonly roleLockEnabled: boolean;
  readonly ghostBaselineRunId: string | null;
  readonly legendOwnerUserId: string | null;

  readonly occurrenceCount: number;
  readonly sameCardInHandCount: number;
  readonly sameCardDiscardCount: number;
  readonly sameCardExhaustCount: number;
  readonly sameCardDrawHistoryCount: number;
  readonly sameCardLastPlayedCount: number;
  readonly sameCardGhostMarkerCount: number;
}

interface NormalizedOverlayState {
  readonly costModifier: number;
  readonly effectModifier: number;
  readonly targetingOverride?: Targeting;
  readonly divergencePotential?: DivergencePotential;
  readonly tagWeights: Readonly<Record<string, number>>;
  readonly timingLock: readonly TimingClass[];
  readonly trace: readonly OverlayTraceComponent[];
}

interface CostResolution {
  readonly baseCost: number;
  readonly modifier: number;
  readonly resolvedCost: number;
  readonly trace: readonly OverlayTraceComponent[];
}

interface TimingResolution {
  readonly canonicalTiming: readonly TimingClass[];
  readonly trace: readonly OverlayTraceComponent[];
}

interface TagResolution {
  readonly tags: readonly string[];
  readonly weightedTags: readonly WeightedTagContribution[];
  readonly trace: readonly OverlayTraceComponent[];
}

interface DivergenceResolution {
  readonly potential: DivergencePotential;
  readonly score: number;
  readonly dominantAxis: DivergenceAxis;
  readonly trace: readonly OverlayTraceComponent[];
}

interface DecayResolution {
  readonly decayTicksRemaining: number | null;
  readonly trace: readonly OverlayTraceComponent[];
}

interface OverlayComputation {
  readonly context: SnapshotContext;
  readonly effectSummary: DoctrineEffectSummary;
  readonly normalizedOverlay: NormalizedOverlayState;
  readonly cost: CostResolution;
  readonly timing: TimingResolution;
  readonly tags: TagResolution;
  readonly divergence: DivergenceResolution;
  readonly decay: DecayResolution;
  readonly trace: readonly OverlayTraceComponent[];
}

interface OverlayAuditEnvelope {
  readonly baseCost: number;
  readonly resolvedCost: number;
  readonly costModifier: number;
  readonly effectModifier: number;
  readonly timingClass: readonly TimingClass[];
  readonly targeting: Targeting;
  readonly divergencePotential: DivergencePotential;
  readonly decayTicksRemaining: number | null;
  readonly weightedTags: readonly WeightedTagContribution[];
  readonly trace: readonly OverlayTraceComponent[];
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
}

function round4(value: number): number {
  return Math.round(value * FLOAT_PRECISION_4) / FLOAT_PRECISION_4;
}

function round3(value: number): number {
  return Math.round(value * FLOAT_PRECISION_3) / FLOAT_PRECISION_3;
}

function toFiniteOrFallback(
  value: number | undefined | null,
  fallback: number,
): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function safeDivide(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator)) {
    return 0;
  }

  if (!Number.isFinite(denominator) || denominator === 0) {
    return 0;
  }

  return numerator / denominator;
}

function normalizeModifier(
  modifier: number,
  min: number,
  max: number,
): number {
  return round4(clamp(modifier, min, max));
}

function normalizeWeight(weight: number): number {
  return round4(clamp(weight, 0, 10));
}

function asPositiveInteger(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value));
}

function roundMoneyLike(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Number(value.toFixed(COST_DECIMAL_PRECISION));
}

function uniqueStrings(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }

    seen.add(value);
    output.push(value);
  }

  return output;
}

function uniqueTimingClasses(values: readonly TimingClass[]): TimingClass[] {
  const seen = new Set<TimingClass>();
  const output: TimingClass[] = [];

  for (const timing of TIMING_CLASS_ORDER) {
    if (values.includes(timing) && !seen.has(timing)) {
      seen.add(timing);
      output.push(timing);
    }
  }

  for (const timing of values) {
    if (seen.has(timing)) {
      continue;
    }

    seen.add(timing);
    output.push(timing);
  }

  return output;
}

function sortTagsStably(values: readonly string[]): string[] {
  return [...values].sort((left, right) => {
    if (left === right) {
      return 0;
    }

    return left < right ? -1 : 1;
  });
}

function clipTagCollection(values: readonly string[], limit: number): string[] {
  if (values.length <= limit) {
    return [...values];
  }

  return values.slice(0, limit);
}

function countOccurrences(values: readonly string[], target: string): number {
  let count = 0;

  for (const value of values) {
    if (value === target) {
      count += 1;
    }
  }

  return count;
}

function serializeTraceComponent(component: OverlayTraceComponent): string {
  return `${component.key}=${String(component.value)}`;
}

function dedupeTrace(
  components: readonly OverlayTraceComponent[],
): OverlayTraceComponent[] {
  const seen = new Set<string>();
  const output: OverlayTraceComponent[] = [];

  for (const component of components) {
    const signature = serializeTraceComponent(component);

    if (seen.has(signature)) {
      continue;
    }

    seen.add(signature);
    output.push(component);

    if (output.length >= MAX_TRACE_COMPONENTS) {
      break;
    }
  }

  return output;
}

function summarizeBooleansAsTag(prefix: string, value: boolean): string {
  return `${prefix}:${value ? 'ON' : 'OFF'}`;
}

function summarizeNullableStringTag(
  prefix: string,
  value: string | null | undefined,
): string {
  return `${prefix}:${value ?? 'NONE'}`;
}

function summarizeBandTag(prefix: string, value: string): string {
  return `${prefix}:${value}`;
}

function buildWeightTag(tag: string, weight: number): string {
  return `${tag}:${round4(weight)}`;
}

function buildScalarTag(label: string, value: number): string {
  return `${label}:${round4(value)}`;
}

function buildIntegerTag(label: string, value: number): string {
  return `${label}:${asPositiveInteger(value)}`;
}

function pushIfAbsent(target: string[], value: string): void {
  if (!target.includes(value)) {
    target.push(value);
  }
}

function pushTrace(
  target: OverlayTraceComponent[],
  key: string,
  value: string | number | boolean | null,
): void {
  target.push({ key, value });
}

function resolveNumericBand(
  value: number,
  lowThreshold: number,
  mediumThreshold: number,
  highThreshold: number,
  criticalThreshold: number,
): NumericBand {
  if (value <= 0) {
    return 'ZERO';
  }

  if (value < lowThreshold) {
    return 'LOW';
  }

  if (value < mediumThreshold) {
    return 'MEDIUM';
  }

  if (value < highThreshold) {
    return 'HIGH';
  }

  if (value < criticalThreshold) {
    return 'CRITICAL';
  }

  return 'CRITICAL';
}

function resolveShieldBand(weakestLayerRatio: number): ShieldBand {
  if (weakestLayerRatio >= SHIELD_SAFE_THRESHOLD) {
    return 'FORTIFIED';
  }

  if (weakestLayerRatio >= SHIELD_WATCH_THRESHOLD) {
    return 'STABLE';
  }

  if (weakestLayerRatio >= SHIELD_RISK_THRESHOLD) {
    return 'WATCH';
  }

  if (weakestLayerRatio >= SHIELD_BREAKPOINT_THRESHOLD) {
    return 'RISK';
  }

  return 'BREAKPOINT';
}

function resolveTrustBand(trust: number): TrustBand {
  if (trust < TRUST_BROKEN_THRESHOLD) {
    return 'BROKEN';
  }

  if (trust < TRUST_LOW_THRESHOLD) {
    return 'LOW';
  }

  if (trust < TRUST_STABLE_THRESHOLD) {
    return 'STABLE';
  }

  if (trust < TRUST_HIGH_THRESHOLD) {
    return 'HIGH';
  }

  return 'LOCKED';
}

function resolvePhaseBoundaryBand(remaining: number): PhaseBoundaryBand {
  if (remaining <= 0) {
    return 'NONE';
  }

  if (remaining <= PHASE_BOUNDARY_HIGH_URGENCY) {
    return 'HIGH';
  }

  if (remaining <= PHASE_BOUNDARY_MEDIUM_URGENCY) {
    return 'MEDIUM';
  }

  if (remaining <= PHASE_BOUNDARY_LOW_URGENCY) {
    return 'LOW';
  }

  return 'LOW';
}

function resolvePressureBand(score: number): NumericBand {
  return resolveNumericBand(
    score,
    PRESSURE_LOW_THRESHOLD,
    PRESSURE_MEDIUM_THRESHOLD,
    PRESSURE_HIGH_THRESHOLD,
    PRESSURE_CRITICAL_THRESHOLD,
  );
}

function resolveTensionBand(score: number): NumericBand {
  return resolveNumericBand(
    score,
    TENSION_LOW_THRESHOLD,
    TENSION_MEDIUM_THRESHOLD,
    TENSION_HIGH_THRESHOLD,
    TENSION_CRITICAL_THRESHOLD,
  );
}

function resolveHeatBand(heat: number): NumericBand {
  if (heat <= 0) {
    return 'ZERO';
  }

  if (heat < HEAT_LOW_THRESHOLD) {
    return 'LOW';
  }

  if (heat < HEAT_MEDIUM_THRESHOLD) {
    return 'MEDIUM';
  }

  if (heat < HEAT_HIGH_THRESHOLD) {
    return 'HIGH';
  }

  if (heat < HEAT_CRITICAL_THRESHOLD) {
    return 'CRITICAL';
  }

  return 'CRITICAL';
}

function countKnownCardOccurrences(
  snapshot: RunStateSnapshot,
  definitionId: string,
): {
  readonly total: number;
  readonly hand: number;
  readonly discard: number;
  readonly exhaust: number;
  readonly drawHistory: number;
  readonly lastPlayed: number;
  readonly ghostMarkers: number;
} {
  const hand = snapshot.cards.hand.filter(
    (card) => card.definitionId === definitionId,
  ).length;

  const discard = countOccurrences(snapshot.cards.discard, definitionId);
  const exhaust = countOccurrences(snapshot.cards.exhaust, definitionId);
  const drawHistory = countOccurrences(snapshot.cards.drawHistory, definitionId);
  const lastPlayed = countOccurrences(snapshot.cards.lastPlayed, definitionId);
  const ghostMarkers = snapshot.cards.ghostMarkers.filter(
    (marker) => marker.cardId === definitionId,
  ).length;

  return {
    total:
      hand +
      discard +
      exhaust +
      drawHistory +
      lastPlayed +
      ghostMarkers,
    hand,
    discard,
    exhaust,
    drawHistory,
    lastPlayed,
    ghostMarkers,
  };
}

function resolveWeakestLayerCurrent(snapshot: RunStateSnapshot): number {
  for (const layer of snapshot.shield.layers) {
    if (layer.layerId === snapshot.shield.weakestLayerId) {
      return layer.current;
    }
  }

  return 0;
}

function resolveWeakestLayerMax(snapshot: RunStateSnapshot): number {
  for (const layer of snapshot.shield.layers) {
    if (layer.layerId === snapshot.shield.weakestLayerId) {
      return layer.max;
    }
  }

  return 0;
}

function resolveShieldAverageRatio(snapshot: RunStateSnapshot): number {
  if (snapshot.shield.layers.length === 0) {
    return 1;
  }

  let total = 0;

  for (const layer of snapshot.shield.layers) {
    total += layer.integrityRatio;
  }

  return round4(total / snapshot.shield.layers.length);
}

function resolveThreatDensity(snapshot: RunStateSnapshot): number {
  const denominator = Math.max(
    1,
    snapshot.cards.drawPileSize +
      snapshot.cards.hand.length +
      snapshot.battle.pendingAttacks.length +
      snapshot.tension.visibleThreats.length,
  );

  return round4(
    safeDivide(
      snapshot.tension.visibleThreats.length +
        snapshot.battle.pendingAttacks.length,
      denominator,
    ),
  );
}

function resolveCascadeDensity(snapshot: RunStateSnapshot): number {
  const denominator = Math.max(1, snapshot.tick + 1);

  return round4(
    safeDivide(
      snapshot.cascade.activeChains.length +
        snapshot.cascade.brokenChains +
        snapshot.cascade.completedChains,
      denominator,
    ),
  );
}

function resolveModeFactor(
  snapshot: RunStateSnapshot,
  card: CardDefinition,
): number {
  switch (snapshot.mode) {
    case 'solo':
      if (card.deckType === 'OPPORTUNITY') {
        return SOLO_OPPORTUNITY_FACTOR;
      }

      if (card.deckType === 'IPA') {
        return SOLO_IPA_FACTOR;
      }

      if (card.deckType === 'PRIVILEGED') {
        return SOLO_PRIVILEGED_FACTOR;
      }

      if (card.deckType === 'SO') {
        return SOLO_SO_FACTOR;
      }

      if (card.deckType === 'FUBAR') {
        return SOLO_FUBAR_FACTOR;
      }

      return 1;

    case 'pvp':
      if (card.deckType === 'SABOTAGE') {
        return PVP_SABOTAGE_FACTOR;
      }

      if (card.deckType === 'COUNTER') {
        return PVP_COUNTER_FACTOR;
      }

      if (card.deckType === 'BLUFF') {
        return PVP_BLUFF_FACTOR;
      }

      if (
        card.deckType === 'OPPORTUNITY' ||
        card.deckType === 'IPA' ||
        card.deckType === 'PRIVILEGED'
      ) {
        return PVP_BUILD_FACTOR;
      }

      return 1;

    case 'coop':
      if (card.deckType === 'AID') {
        return COOP_AID_FACTOR;
      }

      if (card.deckType === 'RESCUE') {
        return COOP_RESCUE_FACTOR;
      }

      if (card.deckType === 'TRUST') {
        return COOP_TRUST_FACTOR;
      }

      if (card.tags.includes('shared_objective')) {
        return COOP_SHARED_OBJECTIVE_FACTOR;
      }

      return 1;

    case 'ghost':
      if (card.deckType === 'GHOST') {
        return GHOST_GHOST_FACTOR;
      }

      if (card.deckType === 'DISCIPLINE') {
        return GHOST_DISCIPLINE_FACTOR;
      }

      if (
        card.tags.includes('precision') ||
        card.tags.includes('legend') ||
        card.tags.includes('divergence')
      ) {
        return GHOST_PRECISION_FACTOR;
      }

      return 1;

    default:
      return 1;
  }
}

function resolvePhaseFactor(
  phase: string,
  card: CardDefinition,
): number {
  if (phase === 'FOUNDATION') {
    if (card.deckType === 'OPPORTUNITY' || card.deckType === 'IPA') {
      return 1.1;
    }

    if (card.deckType === 'FUBAR') {
      return 0.88;
    }

    return 1;
  }

  if (phase === 'ESCALATION') {
    if (
      card.deckType === 'SABOTAGE' ||
      card.deckType === 'COUNTER' ||
      card.deckType === 'BLUFF' ||
      card.deckType === 'RESCUE' ||
      card.deckType === 'SO'
    ) {
      return 1.12;
    }

    return 1.02;
  }

  if (phase === 'SOVEREIGNTY') {
    if (
      card.deckType === 'GHOST' ||
      card.deckType === 'DISCIPLINE' ||
      card.deckType === 'TRUST' ||
      card.tags.includes('phase_boundary')
    ) {
      return 1.16;
    }

    return 1.04;
  }

  return 1;
}

function resolveThreatFactor(
  snapshot: RunStateSnapshot,
  card: CardDefinition,
): number {
  const density = resolveThreatDensity(snapshot);

  if (density < THREAT_LOW_THRESHOLD) {
    if (card.deckType === 'COUNTER' || card.deckType === 'RESCUE') {
      return 0.92;
    }

    return 1;
  }

  if (density < THREAT_MEDIUM_THRESHOLD) {
    if (card.deckType === 'COUNTER' || card.deckType === 'RESCUE') {
      return 1.08;
    }

    if (card.deckType === 'SABOTAGE') {
      return 1.04;
    }

    return 1;
  }

  if (density < THREAT_HIGH_THRESHOLD) {
    if (
      card.deckType === 'COUNTER' ||
      card.deckType === 'RESCUE' ||
      card.tags.includes('resilience')
    ) {
      return 1.16;
    }

    if (card.deckType === 'SABOTAGE' || card.deckType === 'BLUFF') {
      return 1.08;
    }

    return 1.04;
  }

  if (
    card.deckType === 'COUNTER' ||
    card.deckType === 'RESCUE' ||
    card.tags.includes('resilience')
  ) {
    return 1.24;
  }

  if (card.deckType === 'SABOTAGE' || card.deckType === 'BLUFF') {
    return 1.12;
  }

  return 1.06;
}

function resolveCascadeFactor(
  snapshot: RunStateSnapshot,
  card: CardDefinition,
): number {
  const density = resolveCascadeDensity(snapshot);

  if (density <= 0) {
    if (card.tags.includes('cascade')) {
      return 0.92;
    }

    return 1;
  }

  if (card.tags.includes('cascade')) {
    return round4(1 + Math.min(0.3, density));
  }

  if (card.deckType === 'SO' || card.deckType === 'RESCUE') {
    return round4(1 + Math.min(0.16, density / 2));
  }

  return 1;
}

function resolveHeatFactor(
  snapshot: RunStateSnapshot,
  card: CardDefinition,
): number {
  const heatBand = resolveHeatBand(snapshot.economy.haterHeat);

  if (heatBand === 'ZERO' || heatBand === 'LOW') {
    if (card.deckType === 'PRIVILEGED') {
      return 1.04;
    }

    return 1;
  }

  if (heatBand === 'MEDIUM') {
    if (card.deckType === 'PRIVILEGED' || card.tags.includes('heat')) {
      return 1.08;
    }

    if (card.tags.includes('resilience')) {
      return 1.06;
    }

    return 1;
  }

  if (heatBand === 'HIGH') {
    if (card.deckType === 'PRIVILEGED') {
      return 0.94;
    }

    if (card.tags.includes('resilience') || card.tags.includes('counter')) {
      return 1.12;
    }

    return 1.04;
  }

  if (card.deckType === 'PRIVILEGED') {
    return 0.88;
  }

  if (
    card.tags.includes('resilience') ||
    card.tags.includes('counter') ||
    card.deckType === 'RESCUE'
  ) {
    return 1.18;
  }

  return 1.06;
}

function resolveTrustFactor(
  snapshot: RunStateSnapshot,
  card: CardDefinition,
): number {
  if (snapshot.mode !== 'coop') {
    return 1;
  }

  const trust = snapshot.modeState.trustScores[snapshot.userId] ?? 0;

  if (card.deckType === 'TRUST') {
    if (trust < TRUST_LOW_THRESHOLD) {
      return 1.22;
    }

    if (trust < TRUST_STABLE_THRESHOLD) {
      return 1.14;
    }

    return 1.04;
  }

  if (card.deckType === 'AID' || card.deckType === 'RESCUE') {
    if (trust < TRUST_BROKEN_THRESHOLD) {
      return 0.84;
    }

    if (trust < TRUST_LOW_THRESHOLD) {
      return 0.92;
    }

    if (trust < TRUST_STABLE_THRESHOLD) {
      return 1.04;
    }

    return 1.14;
  }

  return 1;
}

function resolveHoldFactor(
  snapshot: RunStateSnapshot,
  card: CardDefinition,
): number {
  if (!snapshot.modeState.holdEnabled) {
    return 1;
  }

  if (!card.timingClass.includes('PRE') && !card.timingClass.includes('PHZ')) {
    return 1;
  }

  if (snapshot.timers.holdCharges <= 0) {
    return 0.96;
  }

  if (snapshot.timers.holdCharges >= 2) {
    return 1.08;
  }

  return 1.04;
}

function resolvePrecisionFactor(
  snapshot: RunStateSnapshot,
  card: CardDefinition,
): number {
  if (!card.tags.includes('precision') && card.deckType !== 'DISCIPLINE') {
    return 1;
  }

  if (snapshot.mode !== 'ghost') {
    return 1.06;
  }

  if (snapshot.modeState.legendMarkersEnabled) {
    return 1.18;
  }

  return 1.04;
}

function resolveVarianceFactor(
  snapshot: RunStateSnapshot,
  card: CardDefinition,
): number {
  if (!card.tags.includes('variance')) {
    return 1;
  }

  if (snapshot.mode === 'ghost') {
    return 1.16;
  }

  if (snapshot.mode === 'pvp') {
    return 1.12;
  }

  return 1.04;
}

function resolveRepetitionFactor(
  occurrenceCount: number,
  card: CardDefinition,
): number {
  if (occurrenceCount <= 1) {
    return 1;
  }

  if (
    card.deckType === 'IPA' ||
    card.deckType === 'TRUST' ||
    card.tags.includes('chain') ||
    card.tags.includes('compounding')
  ) {
    return round4(1 + Math.min(0.24, occurrenceCount * 0.04));
  }

  if (
    card.deckType === 'SABOTAGE' ||
    card.deckType === 'COUNTER' ||
    card.deckType === 'BLUFF'
  ) {
    return round4(1 + Math.min(0.16, occurrenceCount * 0.03));
  }

  return round4(1 - Math.min(0.12, occurrenceCount * 0.02));
}

function resolveMarkerFactor(
  snapshot: RunStateSnapshot,
  card: CardDefinition,
): number {
  if (snapshot.mode !== 'ghost') {
    return 1;
  }

  if (card.deckType !== 'GHOST' && card.deckType !== 'DISCIPLINE') {
    return 1;
  }

  if (!snapshot.modeState.legendMarkersEnabled) {
    return 0.9;
  }

  if (snapshot.cards.ghostMarkers.length === 0) {
    return 1.02;
  }

  return round4(1 + Math.min(0.2, snapshot.cards.ghostMarkers.length * 0.03));
}

function resolveDoctrineRole(
  snapshot: RunStateSnapshot,
  card: CardDefinition,
): DoctrineRole {
  if (card.tags.includes('phase_boundary') || card.timingClass.includes('PHZ')) {
    return 'PHASE_BOUNDARY';
  }

  if (snapshot.mode === 'pvp') {
    if (card.deckType === 'SABOTAGE' || card.deckType === 'BLUFF') {
      return 'TEMPO_ATTACK';
    }

    if (card.deckType === 'COUNTER' || card.timingClass.includes('CTR')) {
      return 'COUNTER_WINDOW';
    }
  }

  if (snapshot.mode === 'coop') {
    if (card.deckType === 'AID' || card.tags.includes('aid')) {
      return 'COOP_CONTRACT';
    }

    if (card.deckType === 'RESCUE' || card.timingClass.includes('RES')) {
      return 'COOP_RESCUE';
    }
  }

  if (snapshot.mode === 'ghost') {
    if (card.deckType === 'GHOST') {
      return 'PRECISION_GHOST';
    }

    if (card.deckType === 'DISCIPLINE' || card.tags.includes('variance')) {
      return 'VARIANCE_DISCIPLINE';
    }
  }

  if (
    card.deckType === 'OPPORTUNITY' ||
    card.deckType === 'IPA' ||
    card.tags.includes('income') ||
    card.tags.includes('scale')
  ) {
    return 'ECONOMIC_ENGINE';
  }

  if (card.deckType === 'SO') {
    return 'SYSTEM_CONVERSION';
  }

  if (card.deckType === 'PRIVILEGED' || card.tags.includes('heat')) {
    return 'HEAT_RISK';
  }

  return 'GENERALIST';
}

function resolveDoctrineRoleTags(role: DoctrineRole): string[] {
  switch (role) {
    case 'ECONOMIC_ENGINE':
      return ['doctrine_role:economic_engine', 'doctrine_axis:compounding'];

    case 'TEMPO_ATTACK':
      return ['doctrine_role:tempo_attack', 'doctrine_axis:aggression'];

    case 'COUNTER_WINDOW':
      return ['doctrine_role:counter_window', 'doctrine_axis:deflection'];

    case 'COOP_CONTRACT':
      return ['doctrine_role:coop_contract', 'doctrine_axis:contract'];

    case 'COOP_RESCUE':
      return ['doctrine_role:coop_rescue', 'doctrine_axis:stabilization'];

    case 'PRECISION_GHOST':
      return ['doctrine_role:precision_ghost', 'doctrine_axis:divergence'];

    case 'VARIANCE_DISCIPLINE':
      return ['doctrine_role:variance_discipline', 'doctrine_axis:variance'];

    case 'PHASE_BOUNDARY':
      return ['doctrine_role:phase_boundary', 'doctrine_axis:window'];

    case 'HEAT_RISK':
      return ['doctrine_role:heat_risk', 'doctrine_axis:scrutiny'];

    case 'SYSTEM_CONVERSION':
      return ['doctrine_role:system_conversion', 'doctrine_axis:conversion'];

    default:
      return ['doctrine_role:generalist', 'doctrine_axis:flex'];
  }
}

function buildEffectSummary(card: CardDefinition): DoctrineEffectSummary {
  return {
    cashDelta: round4(card.baseEffect.cashDelta ?? 0),
    debtDelta: round4(card.baseEffect.debtDelta ?? 0),
    incomeDelta: round4(card.baseEffect.incomeDelta ?? 0),
    expenseDelta: round4(card.baseEffect.expenseDelta ?? 0),
    shieldDelta: round4(card.baseEffect.shieldDelta ?? 0),
    heatDelta: round4(card.baseEffect.heatDelta ?? 0),
    trustDelta: round4(card.baseEffect.trustDelta ?? 0),
    treasuryDelta: round4(card.baseEffect.treasuryDelta ?? 0),
    battleBudgetDelta: round4(card.baseEffect.battleBudgetDelta ?? 0),
    holdChargeDelta: round4(card.baseEffect.holdChargeDelta ?? 0),
    counterIntelDelta: round4(card.baseEffect.counterIntelDelta ?? 0),
    timeDeltaMs: round4(card.baseEffect.timeDeltaMs ?? 0),
    divergenceDelta: round4(card.baseEffect.divergenceDelta ?? 0),
    cascadeTag: card.baseEffect.cascadeTag ?? null,
    injectCardsCount: card.baseEffect.injectCards?.length ?? 0,
    exhaustCardsCount: card.baseEffect.exhaustCards?.length ?? 0,
    grantBadgesCount: card.baseEffect.grantBadges?.length ?? 0,
    namedActionId: card.baseEffect.namedActionId ?? null,
  };
}

function buildResolutionContext(
  snapshot: RunStateSnapshot,
  card: CardDefinition,
): SnapshotContext {
  const occurrenceCounts = countKnownCardOccurrences(snapshot, card.id);
  const weakestLayerCurrent = resolveWeakestLayerCurrent(snapshot);
  const weakestLayerMax = resolveWeakestLayerMax(snapshot);
  const shieldAverageRatio = resolveShieldAverageRatio(snapshot);
  const threatDensity = resolveThreatDensity(snapshot);
  const cascadeDensity = resolveCascadeDensity(snapshot);
  const pressureBand = resolvePressureBand(snapshot.pressure.score);
  const tensionBand = resolveTensionBand(snapshot.tension.score);
  const trustSelf = snapshot.modeState.trustScores[snapshot.userId] ?? 0;

  return {
    mode: snapshot.mode,
    tick: snapshot.tick,
    phase: snapshot.phase,
    outcomePresent: snapshot.outcome !== null,

    cash: snapshot.economy.cash,
    debt: snapshot.economy.debt,
    incomePerTick: snapshot.economy.incomePerTick,
    expensesPerTick: snapshot.economy.expensesPerTick,
    netWorth: snapshot.economy.netWorth,
    freedomTarget: snapshot.economy.freedomTarget,
    cashRatioToFreedom: round4(
      safeDivide(
        snapshot.economy.cash,
        snapshot.economy.freedomTarget || DEFAULT_FREEDOM_TARGET,
      ),
    ),
    debtRatioToFreedom: round4(
      safeDivide(
        snapshot.economy.debt,
        snapshot.economy.freedomTarget || DEFAULT_FREEDOM_TARGET,
      ),
    ),
    netWorthRatioToFreedom: round4(
      safeDivide(
        snapshot.economy.netWorth,
        snapshot.economy.freedomTarget || DEFAULT_FREEDOM_TARGET,
      ),
    ),

    pressureScore: round4(snapshot.pressure.score),
    pressureBand,
    pressureTier: snapshot.pressure.tier,
    survivedHighPressureTicks: snapshot.pressure.survivedHighPressureTicks,

    tensionScore: round4(snapshot.tension.score),
    tensionBand,
    visibleThreatCount: snapshot.tension.visibleThreats.length,
    threatDensity,
    maxPulseTriggered: snapshot.tension.maxPulseTriggered,

    shieldAverageRatio,
    shieldBand: resolveShieldBand(snapshot.shield.weakestLayerRatio),
    weakestLayerId: snapshot.shield.weakestLayerId,
    weakestLayerRatio: round4(snapshot.shield.weakestLayerRatio),
    weakestLayerCurrent,
    weakestLayerMax,
    breachCount: snapshot.shield.breachesThisRun,

    battleBudget: snapshot.battle.battleBudget,
    battleBudgetCap: snapshot.battle.battleBudgetCap,
    battleBudgetRatio: round4(
      safeDivide(
        snapshot.battle.battleBudget,
        snapshot.battle.battleBudgetCap || DEFAULT_BATTLE_BUDGET_CAP,
      ),
    ),
    neutralizedBotCount: snapshot.battle.neutralizedBotIds.length,
    activeBotCount: snapshot.battle.bots.filter((bot) => !bot.neutralized).length,
    pendingAttackCount: snapshot.battle.pendingAttacks.length,
    extractionCooldownTicks: snapshot.battle.extractionCooldownTicks,
    extractionActionsRemaining: snapshot.modeState.extractionActionsRemaining,
    firstBloodClaimed: snapshot.battle.firstBloodClaimed,
    sharedOpportunityDeckCursor: snapshot.battle.sharedOpportunityDeckCursor,
    rivalryHeatCarry: snapshot.battle.rivalryHeatCarry,

    activeCascadeCount: snapshot.cascade.activeChains.length,
    brokenChainCount: snapshot.cascade.brokenChains,
    completedChainCount: snapshot.cascade.completedChains,
    cascadeDensity,
    repeatedTriggerDistinctCount: Object.keys(snapshot.cascade.repeatedTriggerCounts).length,

    sovereigntyScore: round4(snapshot.sovereignty.sovereigntyScore),
    gapVsLegend: round4(snapshot.sovereignty.gapVsLegend),
    gapClosingRate: round4(snapshot.sovereignty.gapClosingRate),
    proofBadgeCount: snapshot.sovereignty.proofBadges.length,
    auditFlagCount: snapshot.sovereignty.auditFlags.length,

    drawPileSize: snapshot.cards.drawPileSize || DEFAULT_DRAW_PILE_SIZE,
    deckEntropy: round4(snapshot.cards.deckEntropy || DEFAULT_DECK_ENTROPY),
    handSize: snapshot.cards.hand.length,
    discardSize: snapshot.cards.discard.length,
    exhaustSize: snapshot.cards.exhaust.length,
    drawHistorySize: snapshot.cards.drawHistory.length,
    lastPlayedSize: snapshot.cards.lastPlayed.length,
    ghostMarkerCount: snapshot.cards.ghostMarkers.length,

    holdEnabled: snapshot.modeState.holdEnabled,
    holdCharges: snapshot.timers.holdCharges,
    activeDecisionWindowCount: Object.keys(snapshot.timers.activeDecisionWindows).length,
    frozenWindowCount: snapshot.timers.frozenWindowIds.length,
    seasonBudgetMs: snapshot.timers.seasonBudgetMs,
    extensionBudgetMs: snapshot.timers.extensionBudgetMs,
    elapsedMs: snapshot.timers.elapsedMs,
    currentTickDurationMs: snapshot.timers.currentTickDurationMs,

    trustSelf,
    trustBand: resolveTrustBand(trustSelf),
    roleAssignedToSelf: snapshot.modeState.roleAssignments[snapshot.userId] ?? null,
    defectionStepForSelf: snapshot.modeState.defectionStepByPlayer[snapshot.userId] ?? 0,
    sharedTreasury: snapshot.modeState.sharedTreasury,
    sharedTreasuryBalance: snapshot.modeState.sharedTreasuryBalance,
    sharedTreasuryRatio: round4(
      safeDivide(
        snapshot.modeState.sharedTreasuryBalance,
        Math.max(
          DEFAULT_SHARED_TREASURY_BALANCE,
          snapshot.economy.freedomTarget,
        ),
      ),
    ),
    legendMarkersEnabled: snapshot.modeState.legendMarkersEnabled,
    communityHeatModifier: toFiniteOrFallback(
      snapshot.modeState.communityHeatModifier,
      DEFAULT_HEAT_MODIFIER,
    ),
    sharedOpportunityDeck: snapshot.modeState.sharedOpportunityDeck,
    counterIntelTier: snapshot.modeState.counterIntelTier,
    spectatorLimit: snapshot.modeState.spectatorLimit,
    phaseBoundaryWindowsRemaining: snapshot.modeState.phaseBoundaryWindowsRemaining,
    phaseBoundaryBand: resolvePhaseBoundaryBand(
      snapshot.modeState.phaseBoundaryWindowsRemaining,
    ),
    bleedMode: snapshot.modeState.bleedMode,
    handicapCount: snapshot.modeState.handicapIds.length,
    advantageId: snapshot.modeState.advantageId,
    disabledBotCount: snapshot.modeState.disabledBots.length,
    modePresentation: snapshot.modeState.modePresentation,
    roleLockEnabled: snapshot.modeState.roleLockEnabled,
    ghostBaselineRunId: snapshot.modeState.ghostBaselineRunId,
    legendOwnerUserId: snapshot.modeState.legendOwnerUserId,

    occurrenceCount: occurrenceCounts.total,
    sameCardInHandCount: occurrenceCounts.hand,
    sameCardDiscardCount: occurrenceCounts.discard,
    sameCardExhaustCount: occurrenceCounts.exhaust,
    sameCardDrawHistoryCount: occurrenceCounts.drawHistory,
    sameCardLastPlayedCount: occurrenceCounts.lastPlayed,
    sameCardGhostMarkerCount: occurrenceCounts.ghostMarkers,
  };
}

function normalizeOverlayState(
  card: CardDefinition,
  context: SnapshotContext,
): NormalizedOverlayState {
  const overlay = resolveModeOverlay(card, context.mode);
  const trace: OverlayTraceComponent[] = [];

  const normalizedCostModifier = normalizeModifier(
    toFiniteOrFallback(overlay.costModifier, 1),
    COST_MODIFIER_MIN,
    COST_MODIFIER_MAX,
  );
  const normalizedEffectModifier = normalizeModifier(
    toFiniteOrFallback(overlay.effectModifier, 1),
    EFFECT_MODIFIER_MIN,
    EFFECT_MODIFIER_MAX,
  );

  const normalizedTagWeights: Record<string, number> = {};
  const overlayEntries = Object.entries(overlay.tagWeights ?? {});

  for (const [tag, value] of overlayEntries) {
    normalizedTagWeights[tag] = normalizeWeight(
      toFiniteOrFallback(value, DEFAULT_TAG_WEIGHT),
    );
  }

  const normalizedTiming = uniqueTimingClasses([
    ...overlay.timingLock,
  ]);

  pushTrace(trace, 'overlay.mode', context.mode);
  pushTrace(trace, 'overlay.costModifier', normalizedCostModifier);
  pushTrace(trace, 'overlay.effectModifier', normalizedEffectModifier);
  pushTrace(trace, 'overlay.tagWeightCount', Object.keys(normalizedTagWeights).length);
  pushTrace(trace, 'overlay.timingLockCount', normalizedTiming.length);
  pushTrace(trace, 'overlay.targetingOverride', overlay.targetingOverride ?? null);
  pushTrace(
    trace,
    'overlay.divergencePotential',
    overlay.divergencePotential ?? null,
  );

  return {
    costModifier: normalizedCostModifier,
    effectModifier: normalizedEffectModifier,
    targetingOverride: overlay.targetingOverride,
    divergencePotential: overlay.divergencePotential,
    tagWeights: normalizedTagWeights,
    timingLock: normalizedTiming,
    trace: dedupeTrace(trace),
  };
}

function resolveWeightedTags(
  card: CardDefinition,
  context: SnapshotContext,
  overlay: NormalizedOverlayState,
): WeightedTagContribution[] {
  const modeWeights = MODE_TAG_WEIGHTS[context.mode] as Readonly<Record<string, number>>;
  const contributions: WeightedTagContribution[] = [];

  for (const tag of card.tags) {
    const modeWeight = normalizeWeight(
      toFiniteOrFallback(modeWeights[tag], DEFAULT_TAG_WEIGHT),
    );
    const overlayWeight = normalizeWeight(
      toFiniteOrFallback(overlay.tagWeights[tag], modeWeight),
    );

    contributions.push({
      tag,
      baseWeight: DEFAULT_TAG_WEIGHT,
      modeWeight,
      overlayWeight,
      finalWeight: overlayWeight,
    });
  }

  return contributions;
}

function resolveCost(
  card: CardDefinition,
  context: SnapshotContext,
  overlay: NormalizedOverlayState,
): CostResolution {
  const trace: OverlayTraceComponent[] = [];
  const baseCost = roundMoneyLike(card.baseCost);
  const resolvedCost = roundMoneyLike(baseCost * overlay.costModifier);

  pushTrace(trace, 'cost.base', baseCost);
  pushTrace(trace, 'cost.modifier', overlay.costModifier);
  pushTrace(trace, 'cost.resolved', resolvedCost);
  pushTrace(trace, 'cost.affordableNow', context.cash >= resolvedCost);

  return {
    baseCost,
    modifier: overlay.costModifier,
    resolvedCost,
    trace: dedupeTrace(trace),
  };
}

function resolveTiming(
  card: CardDefinition,
  overlay: NormalizedOverlayState,
): TimingResolution {
  const trace: OverlayTraceComponent[] = [];
  const canonicalTiming = uniqueTimingClasses([
    ...card.timingClass,
    ...overlay.timingLock,
  ]);

  pushTrace(trace, 'timing.baseCount', card.timingClass.length);
  pushTrace(trace, 'timing.overlayCount', overlay.timingLock.length);
  pushTrace(trace, 'timing.canonicalCount', canonicalTiming.length);
  pushTrace(trace, 'timing.hasCounterWindow', canonicalTiming.includes('CTR'));
  pushTrace(trace, 'timing.hasRescueWindow', canonicalTiming.includes('RES'));
  pushTrace(trace, 'timing.hasGhostBaseline', canonicalTiming.includes('GBM'));
  pushTrace(trace, 'timing.hasCascade', canonicalTiming.includes('CAS'));
  pushTrace(trace, 'timing.hasPhaseBoundary', canonicalTiming.includes('PHZ'));
  pushTrace(trace, 'timing.hasPressureSink', canonicalTiming.includes('PSK'));
  pushTrace(trace, 'timing.hasAny', canonicalTiming.includes('ANY'));

  return {
    canonicalTiming,
    trace: dedupeTrace(trace),
  };
}

function resolveDecay(
  card: CardDefinition,
  context: SnapshotContext,
  timing: TimingResolution,
): DecayResolution {
  const trace: OverlayTraceComponent[] = [];
  let decayTicksRemaining = card.decayTicks ?? null;

  if (timing.canonicalTiming.includes('CTR') && context.mode === 'pvp') {
    decayTicksRemaining =
      decayTicksRemaining === null
        ? DECAY_COUNTER_WINDOW
        : Math.min(decayTicksRemaining, DECAY_COUNTER_WINDOW);
  }

  if (timing.canonicalTiming.includes('RES') && context.mode === 'coop') {
    decayTicksRemaining =
      decayTicksRemaining === null
        ? DECAY_RESCUE_WINDOW
        : Math.min(decayTicksRemaining, DECAY_RESCUE_WINDOW);
  }

  if (
    timing.canonicalTiming.includes('PHZ') &&
    context.phaseBoundaryWindowsRemaining > 0
  ) {
    const phaseWindowDecay = Math.max(
      DECAY_PHASE_WINDOW_FLOOR,
      context.phaseBoundaryWindowsRemaining,
    );

    decayTicksRemaining =
      decayTicksRemaining === null
        ? phaseWindowDecay
        : Math.min(decayTicksRemaining, phaseWindowDecay);
  }

  if (card.deckType === 'GHOST' && context.mode === 'ghost') {
    decayTicksRemaining =
      decayTicksRemaining === null
        ? DECAY_GHOST_WINDOW
        : Math.min(decayTicksRemaining, DECAY_GHOST_WINDOW);
  }

  if (
    context.holdEnabled &&
    context.holdCharges > 0 &&
    timing.canonicalTiming.includes('PRE') &&
    context.phase === 'FOUNDATION'
  ) {
    decayTicksRemaining =
      decayTicksRemaining === null
        ? DECAY_HOLD_WINDOW
        : Math.min(decayTicksRemaining, DECAY_HOLD_WINDOW);
  }

  pushTrace(trace, 'decay.base', card.decayTicks ?? null);
  pushTrace(trace, 'decay.resolved', decayTicksRemaining);
  pushTrace(trace, 'decay.counterWindow', timing.canonicalTiming.includes('CTR'));
  pushTrace(trace, 'decay.rescueWindow', timing.canonicalTiming.includes('RES'));
  pushTrace(trace, 'decay.phaseWindow', timing.canonicalTiming.includes('PHZ'));
  pushTrace(trace, 'decay.ghostWindow', card.deckType === 'GHOST' && context.mode === 'ghost');
  pushTrace(trace, 'decay.holdWindow', context.holdEnabled && context.holdCharges > 0);

  return {
    decayTicksRemaining,
    trace: dedupeTrace(trace),
  };
}

function resolveEffectDirectionTags(
  effect: DoctrineEffectSummary,
): string[] {
  const tags: string[] = [];

  if (effect.cashDelta !== 0) {
    pushIfAbsent(
      tags,
      effect.cashDelta > 0 ? 'effect_axis:cash_gain' : 'effect_axis:cash_loss',
    );
    pushIfAbsent(tags, buildScalarTag('effect.cash', effect.cashDelta));
  }

  if (effect.debtDelta !== 0) {
    pushIfAbsent(
      tags,
      effect.debtDelta > 0 ? 'effect_axis:debt_up' : 'effect_axis:debt_down',
    );
    pushIfAbsent(tags, buildScalarTag('effect.debt', effect.debtDelta));
  }

  if (effect.incomeDelta !== 0) {
    pushIfAbsent(
      tags,
      effect.incomeDelta > 0 ? 'effect_axis:income_up' : 'effect_axis:income_down',
    );
    pushIfAbsent(tags, buildScalarTag('effect.income', effect.incomeDelta));
  }

  if (effect.expenseDelta !== 0) {
    pushIfAbsent(
      tags,
      effect.expenseDelta > 0 ? 'effect_axis:expense_up' : 'effect_axis:expense_down',
    );
    pushIfAbsent(tags, buildScalarTag('effect.expense', effect.expenseDelta));
  }

  if (effect.shieldDelta !== 0) {
    pushIfAbsent(
      tags,
      effect.shieldDelta > 0 ? 'effect_axis:shield_up' : 'effect_axis:shield_down',
    );
    pushIfAbsent(tags, buildScalarTag('effect.shield', effect.shieldDelta));
  }

  if (effect.heatDelta !== 0) {
    pushIfAbsent(
      tags,
      effect.heatDelta > 0 ? 'effect_axis:heat_up' : 'effect_axis:heat_down',
    );
    pushIfAbsent(tags, buildScalarTag('effect.heat', effect.heatDelta));
  }

  if (effect.trustDelta !== 0) {
    pushIfAbsent(
      tags,
      effect.trustDelta > 0 ? 'effect_axis:trust_up' : 'effect_axis:trust_down',
    );
    pushIfAbsent(tags, buildScalarTag('effect.trust', effect.trustDelta));
  }

  if (effect.treasuryDelta !== 0) {
    pushIfAbsent(
      tags,
      effect.treasuryDelta > 0
        ? 'effect_axis:treasury_up'
        : 'effect_axis:treasury_down',
    );
    pushIfAbsent(tags, buildScalarTag('effect.treasury', effect.treasuryDelta));
  }

  if (effect.battleBudgetDelta !== 0) {
    pushIfAbsent(
      tags,
      effect.battleBudgetDelta > 0
        ? 'effect_axis:battle_budget_up'
        : 'effect_axis:battle_budget_down',
    );
    pushIfAbsent(
      tags,
      buildScalarTag('effect.battle_budget', effect.battleBudgetDelta),
    );
  }

  if (effect.holdChargeDelta !== 0) {
    pushIfAbsent(
      tags,
      effect.holdChargeDelta > 0
        ? 'effect_axis:hold_up'
        : 'effect_axis:hold_down',
    );
    pushIfAbsent(tags, buildScalarTag('effect.hold', effect.holdChargeDelta));
  }

  if (effect.counterIntelDelta !== 0) {
    pushIfAbsent(
      tags,
      effect.counterIntelDelta > 0
        ? 'effect_axis:counter_intel_up'
        : 'effect_axis:counter_intel_down',
    );
    pushIfAbsent(
      tags,
      buildScalarTag('effect.counter_intel', effect.counterIntelDelta),
    );
  }

  if (effect.timeDeltaMs !== 0) {
    pushIfAbsent(
      tags,
      effect.timeDeltaMs > 0 ? 'effect_axis:time_up' : 'effect_axis:time_down',
    );
    pushIfAbsent(tags, buildScalarTag('effect.time_ms', effect.timeDeltaMs));
  }

  if (effect.divergenceDelta !== 0) {
    pushIfAbsent(
      tags,
      effect.divergenceDelta > 0
        ? 'effect_axis:divergence_up'
        : 'effect_axis:divergence_down',
    );
    pushIfAbsent(
      tags,
      buildScalarTag('effect.divergence', effect.divergenceDelta),
    );
  }

  if (effect.cascadeTag !== null) {
    pushIfAbsent(tags, summarizeNullableStringTag('effect.cascade_tag', effect.cascadeTag));
  }

  if (effect.injectCardsCount > 0) {
    pushIfAbsent(tags, buildIntegerTag('effect.inject_cards', effect.injectCardsCount));
  }

  if (effect.exhaustCardsCount > 0) {
    pushIfAbsent(tags, buildIntegerTag('effect.exhaust_cards', effect.exhaustCardsCount));
  }

  if (effect.grantBadgesCount > 0) {
    pushIfAbsent(tags, buildIntegerTag('effect.grant_badges', effect.grantBadgesCount));
  }

  if (effect.namedActionId !== null) {
    pushIfAbsent(tags, summarizeNullableStringTag('effect.named_action', effect.namedActionId));
  }

  return tags;
}

function resolveContextMetadataTags(
  context: SnapshotContext,
): string[] {
  return [
    summarizeBandTag('context.mode', context.mode),
    summarizeBandTag('context.phase', context.phase),
    summarizeBandTag('context.pressure_band', context.pressureBand),
    summarizeBandTag('context.tension_band', context.tensionBand),
    summarizeBandTag('context.shield_band', context.shieldBand),
    summarizeBandTag('context.trust_band', context.trustBand),
    summarizeBandTag('context.phase_window_band', context.phaseBoundaryBand),
    summarizeBandTag('context.pressure_tier', context.pressureTier),
    summarizeNullableStringTag('context.role', context.roleAssignedToSelf),
    summarizeNullableStringTag('context.advantage', context.advantageId),
    summarizeNullableStringTag('context.ghost_baseline', context.ghostBaselineRunId),
    summarizeNullableStringTag('context.legend_owner', context.legendOwnerUserId),
    summarizeBandTag('context.mode_presentation', context.modePresentation),
    summarizeBooleansAsTag('context.outcome_present', context.outcomePresent),
    summarizeBooleansAsTag('context.hold_enabled', context.holdEnabled),
    summarizeBooleansAsTag('context.legend_markers_enabled', context.legendMarkersEnabled),
    summarizeBooleansAsTag('context.shared_treasury', context.sharedTreasury),
    summarizeBooleansAsTag('context.shared_opportunity_deck', context.sharedOpportunityDeck),
    summarizeBooleansAsTag('context.bleed_mode', context.bleedMode),
    summarizeBooleansAsTag('context.role_lock_enabled', context.roleLockEnabled),
    summarizeBooleansAsTag('context.max_pulse_triggered', context.maxPulseTriggered),
    summarizeBooleansAsTag('context.first_blood_claimed', context.firstBloodClaimed),
    buildIntegerTag('context.tick', context.tick),
    buildIntegerTag('context.visible_threats', context.visibleThreatCount),
    buildIntegerTag('context.pending_attacks', context.pendingAttackCount),
    buildIntegerTag('context.active_bots', context.activeBotCount),
    buildIntegerTag('context.neutralized_bots', context.neutralizedBotCount),
    buildIntegerTag('context.active_chains', context.activeCascadeCount),
    buildIntegerTag('context.broken_chains', context.brokenChainCount),
    buildIntegerTag('context.completed_chains', context.completedChainCount),
    buildIntegerTag('context.proof_badges', context.proofBadgeCount),
    buildIntegerTag('context.audit_flags', context.auditFlagCount),
    buildIntegerTag('context.hand_size', context.handSize),
    buildIntegerTag('context.draw_pile_size', context.drawPileSize),
    buildIntegerTag('context.discard_size', context.discardSize),
    buildIntegerTag('context.exhaust_size', context.exhaustSize),
    buildIntegerTag('context.ghost_markers', context.ghostMarkerCount),
    buildIntegerTag('context.hold_charges', context.holdCharges),
    buildIntegerTag('context.active_windows', context.activeDecisionWindowCount),
    buildIntegerTag('context.frozen_windows', context.frozenWindowCount),
    buildIntegerTag('context.counter_intel_tier', context.counterIntelTier),
    buildIntegerTag('context.phase_windows_remaining', context.phaseBoundaryWindowsRemaining),
    buildIntegerTag('context.defection_step', context.defectionStepForSelf),
    buildIntegerTag('context.disabled_bots', context.disabledBotCount),
    buildIntegerTag('context.handicap_count', context.handicapCount),
    buildIntegerTag('context.extraction_actions_remaining', context.extractionActionsRemaining),
    buildIntegerTag('context.spectator_limit', context.spectatorLimit),
    buildScalarTag('context.cash_ratio_to_freedom', context.cashRatioToFreedom),
    buildScalarTag('context.debt_ratio_to_freedom', context.debtRatioToFreedom),
    buildScalarTag('context.networth_ratio_to_freedom', context.netWorthRatioToFreedom),
    buildScalarTag('context.pressure_score', context.pressureScore),
    buildScalarTag('context.tension_score', context.tensionScore),
    buildScalarTag('context.shield_average_ratio', context.shieldAverageRatio),
    buildScalarTag('context.weakest_layer_ratio', context.weakestLayerRatio),
    buildScalarTag('context.threat_density', context.threatDensity),
    buildScalarTag('context.cascade_density', context.cascadeDensity),
    buildScalarTag('context.battle_budget_ratio', context.battleBudgetRatio),
    buildScalarTag('context.shared_treasury_ratio', context.sharedTreasuryRatio),
    buildScalarTag('context.deck_entropy', context.deckEntropy),
    buildScalarTag('context.sovereignty_score', context.sovereigntyScore),
    buildScalarTag('context.gap_vs_legend', context.gapVsLegend),
    buildScalarTag('context.gap_closing_rate', context.gapClosingRate),
    buildScalarTag('context.community_heat_modifier', context.communityHeatModifier),
    buildScalarTag('context.rivalry_heat_carry', context.rivalryHeatCarry),
  ];
}

function resolveDoctrineCompositeScore(
  snapshot: RunStateSnapshot,
  card: CardDefinition,
  context: SnapshotContext,
): number {
  const modeFactor = resolveModeFactor(snapshot, card);
  const phaseFactor = resolvePhaseFactor(context.phase, card);
  const threatFactor = resolveThreatFactor(snapshot, card);
  const cascadeFactor = resolveCascadeFactor(snapshot, card);
  const heatFactor = resolveHeatFactor(snapshot, card);
  const trustFactor = resolveTrustFactor(snapshot, card);
  const holdFactor = resolveHoldFactor(snapshot, card);
  const precisionFactor = resolvePrecisionFactor(snapshot, card);
  const varianceFactor = resolveVarianceFactor(snapshot, card);
  const repeatFactor = resolveRepetitionFactor(context.occurrenceCount, card);
  const markerFactor = resolveMarkerFactor(snapshot, card);

  return round4(
    modeFactor *
      phaseFactor *
      threatFactor *
      cascadeFactor *
      heatFactor *
      trustFactor *
      holdFactor *
      precisionFactor *
      varianceFactor *
      repeatFactor *
      markerFactor,
  );
}

function resolveDoctrineFactorTags(
  snapshot: RunStateSnapshot,
  card: CardDefinition,
  context: SnapshotContext,
): string[] {
  return [
    buildScalarTag('factor.mode', resolveModeFactor(snapshot, card)),
    buildScalarTag('factor.phase', resolvePhaseFactor(context.phase, card)),
    buildScalarTag('factor.threat', resolveThreatFactor(snapshot, card)),
    buildScalarTag('factor.cascade', resolveCascadeFactor(snapshot, card)),
    buildScalarTag('factor.heat', resolveHeatFactor(snapshot, card)),
    buildScalarTag('factor.trust', resolveTrustFactor(snapshot, card)),
    buildScalarTag('factor.hold', resolveHoldFactor(snapshot, card)),
    buildScalarTag('factor.precision', resolvePrecisionFactor(snapshot, card)),
    buildScalarTag('factor.variance', resolveVarianceFactor(snapshot, card)),
    buildScalarTag('factor.repetition', resolveRepetitionFactor(context.occurrenceCount, card)),
    buildScalarTag('factor.marker', resolveMarkerFactor(snapshot, card)),
  ];
}

function resolveDivergence(
  snapshot: RunStateSnapshot,
  card: CardDefinition,
  context: SnapshotContext,
  overlay: NormalizedOverlayState,
  effect: DoctrineEffectSummary,
): DivergenceResolution {
  const trace: OverlayTraceComponent[] = [];
  const explicit = effect.divergenceDelta;
  const role = resolveDoctrineRole(snapshot, card);

  let score = 0;
  let dominantAxis: DivergenceAxis = 'AUDIT';

  const setDominantAxis = (axis: DivergenceAxis, value: number): void => {
    if (value > score) {
      dominantAxis = axis;
    }
  };

  if (explicit >= EXPLICIT_DIVERGENCE_HIGH) {
    score = Math.max(score, 0.56);
    setDominantAxis('EXPLICIT', explicit);
  } else if (explicit >= EXPLICIT_DIVERGENCE_MEDIUM) {
    score = Math.max(score, 0.4);
    setDominantAxis('EXPLICIT', explicit);
  } else if (explicit >= EXPLICIT_DIVERGENCE_LOW) {
    score = Math.max(score, 0.24);
    setDominantAxis('EXPLICIT', explicit);
  }

  if (card.rarity === 'LEGENDARY') {
    score += LEGENDARY_DIVERGENCE_BONUS;
    setDominantAxis('RARITY', LEGENDARY_DIVERGENCE_BONUS);
  } else if (card.rarity === 'RARE') {
    score += RARE_DIVERGENCE_BONUS;
    setDominantAxis('RARITY', RARE_DIVERGENCE_BONUS);
  } else if (card.rarity === 'UNCOMMON') {
    score += UNCOMMON_DIVERGENCE_BONUS;
    setDominantAxis('RARITY', UNCOMMON_DIVERGENCE_BONUS);
  }

  if (
    card.tags.includes('divergence') ||
    card.tags.includes('legend') ||
    card.tags.includes('precision')
  ) {
    score += 0.16;
    setDominantAxis('TAG', 0.16);
  }

  if (snapshot.mode === 'ghost') {
    if (card.deckType === 'GHOST') {
      score += 0.22;
      setDominantAxis('MODE', 0.22);
    }

    if (snapshot.modeState.legendMarkersEnabled) {
      score += 0.12;
      setDominantAxis('GHOST', 0.12);
    }

    if (context.gapVsLegend <= 0.05 && context.gapClosingRate > 0) {
      score += 0.08;
      setDominantAxis('GHOST', 0.08);
    }
  }

  if (context.phase === 'SOVEREIGNTY') {
    score += 0.08;
    setDominantAxis('PHASE', 0.08);
  }

  if (context.pressureBand === 'HIGH' || context.pressureBand === 'CRITICAL') {
    score += 0.05;
    setDominantAxis('PRESSURE', 0.05);
  }

  if (context.tensionBand === 'HIGH' || context.tensionBand === 'CRITICAL') {
    score += 0.05;
    setDominantAxis('TENSION', 0.05);
  }

  if (role === 'PRECISION_GHOST') {
    score += 0.14;
    setDominantAxis('PRECISION', 0.14);
  }

  if (role === 'VARIANCE_DISCIPLINE') {
    score += 0.1;
    setDominantAxis('VARIANCE', 0.1);
  }

  if (context.occurrenceCount > 1) {
    score += Math.min(0.08, context.occurrenceCount * 0.01);
    setDominantAxis('REPETITION', context.occurrenceCount * 0.01);
  }

  if (overlay.divergencePotential === 'HIGH') {
    score = Math.max(score, 0.76);
    setDominantAxis('MODE', 0.76);
  } else if (overlay.divergencePotential === 'MEDIUM') {
    score = Math.max(score, 0.48);
    setDominantAxis('MODE', 0.48);
  } else if (overlay.divergencePotential === 'LOW') {
    score = Math.max(score, 0.18);
    setDominantAxis('MODE', 0.18);
  }

  const normalized = round4(clamp(score, 0, 1));
  let potential: DivergencePotential = 'LOW';

  if (normalized >= 0.72) {
    potential = 'HIGH';
  } else if (normalized >= 0.36) {
    potential = 'MEDIUM';
  }

  pushTrace(trace, 'divergence.score', normalized);
  pushTrace(trace, 'divergence.explicit', explicit);
  pushTrace(trace, 'divergence.overlayPotential', overlay.divergencePotential ?? null);
  pushTrace(trace, 'divergence.role', role);
  pushTrace(trace, 'divergence.dominantAxis', dominantAxis);
  pushTrace(trace, 'divergence.potential', potential);

  return {
    potential,
    score: normalized,
    dominantAxis,
    trace: dedupeTrace(trace),
  };
}

function resolveMetadataTags(
  snapshot: RunStateSnapshot,
  card: CardDefinition,
  context: SnapshotContext,
  overlay: NormalizedOverlayState,
  cost: CostResolution,
  timing: TimingResolution,
  effect: DoctrineEffectSummary,
  weightedTags: readonly WeightedTagContribution[],
  divergence: DivergenceResolution,
  decay: DecayResolution,
): string[] {
  const metadata: string[] = [];
  const role = resolveDoctrineRole(snapshot, card);
  const doctrineComposite = resolveDoctrineCompositeScore(snapshot, card, context);

  pushIfAbsent(metadata, summarizeBandTag('overlay.mode', context.mode));
  pushIfAbsent(metadata, buildScalarTag('overlay.cost_modifier', overlay.costModifier));
  pushIfAbsent(metadata, buildScalarTag('overlay.effect_modifier', overlay.effectModifier));
  pushIfAbsent(
    metadata,
    summarizeNullableStringTag(
      'overlay.targeting_override',
      overlay.targetingOverride ?? null,
    ),
  );
  pushIfAbsent(
    metadata,
    summarizeNullableStringTag(
      'overlay.divergence_potential',
      overlay.divergencePotential ?? null,
    ),
  );

  pushIfAbsent(metadata, buildScalarTag('cost.base', cost.baseCost));
  pushIfAbsent(metadata, buildScalarTag('cost.resolved', cost.resolvedCost));

  pushIfAbsent(metadata, summarizeNullableStringTag('decay.resolved', decay.decayTicksRemaining === null ? null : String(decay.decayTicksRemaining)));

  pushIfAbsent(metadata, summarizeBandTag('divergence.potential', divergence.potential));
  pushIfAbsent(metadata, buildScalarTag('divergence.score', divergence.score));
  pushIfAbsent(metadata, summarizeBandTag('divergence.axis', divergence.dominantAxis));

  pushIfAbsent(metadata, buildScalarTag('doctrine.composite', doctrineComposite));

  for (const doctrineRoleTag of resolveDoctrineRoleTags(role)) {
    pushIfAbsent(metadata, doctrineRoleTag);
  }

  for (const factorTag of resolveDoctrineFactorTags(snapshot, card, context)) {
    pushIfAbsent(metadata, factorTag);
  }

  for (const effectTag of resolveEffectDirectionTags(effect)) {
    pushIfAbsent(metadata, effectTag);
  }

  for (const contextTag of resolveContextMetadataTags(context)) {
    pushIfAbsent(metadata, contextTag);
  }

  for (const timingClass of timing.canonicalTiming) {
    pushIfAbsent(metadata, `timing:${timingClass}`);
  }

  pushIfAbsent(metadata, `card.deck_type:${card.deckType}`);
  pushIfAbsent(metadata, `card.rarity:${card.rarity}`);
  pushIfAbsent(metadata, `card.educational_tag:${card.educationalTag}`);
  pushIfAbsent(metadata, `card.auto_resolve:${card.autoResolve ? 'ON' : 'OFF'}`);
  pushIfAbsent(metadata, `card.counterability:${card.counterability}`);
  pushIfAbsent(metadata, `card.targeting:${card.targeting}`);
  pushIfAbsent(metadata, `card.name:${card.name.replace(/\s+/g, '_').toUpperCase()}`);

  for (const contribution of weightedTags) {
    pushIfAbsent(
      metadata,
      `weight:${contribution.tag}:${round4(contribution.finalWeight)}`,
    );
    pushIfAbsent(
      metadata,
      `weight_mode:${contribution.tag}:${round4(contribution.modeWeight)}`,
    );
    pushIfAbsent(
      metadata,
      `weight_overlay:${contribution.tag}:${round4(contribution.overlayWeight)}`,
    );
  }

  pushIfAbsent(metadata, summarizeBooleansAsTag('context.legend_markers_enabled', context.legendMarkersEnabled));
  pushIfAbsent(metadata, summarizeBooleansAsTag('context.shared_treasury', context.sharedTreasury));
  pushIfAbsent(metadata, summarizeBooleansAsTag('context.hold_enabled', context.holdEnabled));
  pushIfAbsent(metadata, summarizeBooleansAsTag('context.role_lock_enabled', context.roleLockEnabled));
  pushIfAbsent(metadata, summarizeBooleansAsTag('context.shared_opportunity_deck', context.sharedOpportunityDeck));
  pushIfAbsent(metadata, summarizeBooleansAsTag('context.bleed_mode', context.bleedMode));
  pushIfAbsent(metadata, summarizeBooleansAsTag('context.max_pulse_triggered', context.maxPulseTriggered));

  return clipTagCollection(
    uniqueStrings(sortTagsStably(metadata)),
    MAX_METADATA_TAGS,
  );
}

function resolveTags(
  snapshot: RunStateSnapshot,
  card: CardDefinition,
  context: SnapshotContext,
  overlay: NormalizedOverlayState,
  timing: TimingResolution,
  effect: DoctrineEffectSummary,
  divergence: DivergenceResolution,
  decay: DecayResolution,
): TagResolution {
  const trace: OverlayTraceComponent[] = [];
  const baseTags = uniqueStrings(card.tags);
  const weightedTags = resolveWeightedTags(card, context, overlay);
  const weightedTagsAsMetadata = weightedTags.map((entry) =>
    buildWeightTag(entry.tag, entry.finalWeight),
  );

  const metadataTags = resolveMetadataTags(
    snapshot,
    card,
    context,
    overlay,
    resolveCost(card, context, overlay),
    timing,
    effect,
    weightedTags,
    divergence,
    decay,
  );

  const tags = clipTagCollection(
    uniqueStrings([
      ...baseTags,
      ...weightedTagsAsMetadata,
      ...metadataTags,
      buildScalarTag('effect_modifier', overlay.effectModifier),
      buildIntegerTag('occurrence.total', context.occurrenceCount),
      buildIntegerTag('occurrence.hand', context.sameCardInHandCount),
      buildIntegerTag('occurrence.discard', context.sameCardDiscardCount),
      buildIntegerTag('occurrence.exhaust', context.sameCardExhaustCount),
      buildIntegerTag('occurrence.draw_history', context.sameCardDrawHistoryCount),
      buildIntegerTag('occurrence.last_played', context.sameCardLastPlayedCount),
      buildIntegerTag('occurrence.ghost_markers', context.sameCardGhostMarkerCount),
    ]),
    MAX_TAGS,
  );

  pushTrace(trace, 'tags.baseCount', baseTags.length);
  pushTrace(trace, 'tags.weightedCount', weightedTags.length);
  pushTrace(trace, 'tags.metadataCount', metadataTags.length);
  pushTrace(trace, 'tags.finalCount', tags.length);

  return {
    tags,
    weightedTags,
    trace: dedupeTrace(trace),
  };
}

function resolveDeterministicParts(
  snapshot: RunStateSnapshot,
  card: CardDefinition,
  overlay: NormalizedOverlayState,
  context: SnapshotContext,
  timing: TimingResolution,
  divergence: DivergenceResolution,
  decay: DecayResolution,
): readonly (string | number | boolean | null)[] {
  const parts: (string | number | boolean | null)[] = [
    snapshot.seed,
    'card-instance',
    card.id,
    card.name,
    snapshot.mode,
    snapshot.phase,
    snapshot.tick,
    card.deckType,
    card.rarity,
    card.educationalTag,
    card.autoResolve,
    card.counterability,
    card.targeting,
    overlay.costModifier,
    overlay.effectModifier,
    overlay.targetingOverride ?? null,
    overlay.divergencePotential ?? null,
    ...timing.canonicalTiming,
    context.cash,
    context.debt,
    context.incomePerTick,
    context.expensesPerTick,
    context.netWorth,
    context.pressureScore,
    context.tensionScore,
    context.weakestLayerId,
    context.weakestLayerRatio,
    context.battleBudget,
    context.battleBudgetCap,
    context.pendingAttackCount,
    context.activeCascadeCount,
    context.sharedOpportunityDeckCursor,
    context.rivalryHeatCarry,
    context.holdCharges,
    context.activeDecisionWindowCount,
    context.phaseBoundaryWindowsRemaining,
    context.legendMarkersEnabled,
    context.communityHeatModifier,
    context.counterIntelTier,
    context.sharedTreasuryBalance,
    context.ghostMarkerCount,
    context.occurrenceCount,
    context.sameCardInHandCount,
    context.sameCardDiscardCount,
    context.sameCardExhaustCount,
    context.sameCardDrawHistoryCount,
    context.sameCardLastPlayedCount,
    context.sameCardGhostMarkerCount,
    context.drawPileSize,
    context.drawHistorySize,
    context.discardSize,
    context.exhaustSize,
    context.handSize,
    context.deckEntropy,
    context.trustSelf,
    context.defectionStepForSelf,
    context.roleAssignedToSelf,
    context.advantageId,
    context.ghostBaselineRunId,
    context.legendOwnerUserId,
    context.disabledBotCount,
    context.modePresentation,
    divergence.potential,
    divergence.score,
    divergence.dominantAxis,
    decay.decayTicksRemaining,
  ];

  return parts.slice(0, MAX_DETERMINISTIC_PARTS);
}

function computeOverlay(
  snapshot: RunStateSnapshot,
  card: CardDefinition,
): OverlayComputation {
  const context = buildResolutionContext(snapshot, card);
  const effectSummary = buildEffectSummary(card);
  const normalizedOverlay = normalizeOverlayState(card, context);
  const cost = resolveCost(card, context, normalizedOverlay);
  const timing = resolveTiming(card, normalizedOverlay);
  const decay = resolveDecay(card, context, timing);
  const divergence = resolveDivergence(
    snapshot,
    card,
    context,
    normalizedOverlay,
    effectSummary,
  );
  const tags = resolveTags(
    snapshot,
    card,
    context,
    normalizedOverlay,
    timing,
    effectSummary,
    divergence,
    decay,
  );

  const trace: OverlayTraceComponent[] = [
    ...contextToTrace(context),
    ...normalizedOverlay.trace,
    ...cost.trace,
    ...timing.trace,
    ...tags.trace,
    ...divergence.trace,
    ...decay.trace,
  ];

  return {
    context,
    effectSummary,
    normalizedOverlay,
    cost,
    timing,
    tags,
    divergence,
    decay,
    trace: dedupeTrace(trace),
  };
}

function contextToTrace(context: SnapshotContext): OverlayTraceComponent[] {
  const trace: OverlayTraceComponent[] = [];

  pushTrace(trace, 'context.mode', context.mode);
  pushTrace(trace, 'context.tick', context.tick);
  pushTrace(trace, 'context.phase', context.phase);
  pushTrace(trace, 'context.pressureBand', context.pressureBand);
  pushTrace(trace, 'context.tensionBand', context.tensionBand);
  pushTrace(trace, 'context.shieldBand', context.shieldBand);
  pushTrace(trace, 'context.trustBand', context.trustBand);
  pushTrace(trace, 'context.phaseBoundaryBand', context.phaseBoundaryBand);
  pushTrace(trace, 'context.visibleThreatCount', context.visibleThreatCount);
  pushTrace(trace, 'context.pendingAttackCount', context.pendingAttackCount);
  pushTrace(trace, 'context.activeCascadeCount', context.activeCascadeCount);
  pushTrace(trace, 'context.occurrenceCount', context.occurrenceCount);
  pushTrace(trace, 'context.legendMarkersEnabled', context.legendMarkersEnabled);
  pushTrace(trace, 'context.holdCharges', context.holdCharges);

  return dedupeTrace(trace);
}

export class CardOverlayResolver {
  public resolve(
    snapshot: RunStateSnapshot,
    card: CardDefinition,
  ): CardInstance {
    const computation = computeOverlay(snapshot, card);

    const deterministicParts = resolveDeterministicParts(
      snapshot,
      card,
      computation.normalizedOverlay,
      computation.context,
      computation.timing,
      computation.divergence,
      computation.decay,
    );
    const instanceId = createDeterministicId(deterministicParts[0] as string, ...deterministicParts.slice(1));

    return createCardInstance(card, {
      instanceId,
      mode: snapshot.mode,
      cost: computation.cost.resolvedCost,
      timingClass: computation.timing.canonicalTiming,
      targeting:
        computation.normalizedOverlay.targetingOverride ?? card.targeting,
      tags: computation.tags.tags,
      decayTicksRemaining: computation.decay.decayTicksRemaining,
      divergencePotential: computation.divergence.potential,
    });
  }

  public inspect(
    snapshot: RunStateSnapshot,
    card: CardDefinition,
  ): OverlayAuditEnvelope {
    const computation = computeOverlay(snapshot, card);

    return {
      baseCost: computation.cost.baseCost,
      resolvedCost: computation.cost.resolvedCost,
      costModifier: computation.normalizedOverlay.costModifier,
      effectModifier: computation.normalizedOverlay.effectModifier,
      timingClass: computation.timing.canonicalTiming,
      targeting:
        computation.normalizedOverlay.targetingOverride ?? card.targeting,
      divergencePotential: computation.divergence.potential,
      decayTicksRemaining: computation.decay.decayTicksRemaining,
      weightedTags: computation.tags.weightedTags,
      trace: computation.trace,
    };
  }

  public resolveDeterministicFingerprint(
    snapshot: RunStateSnapshot,
    card: CardDefinition,
  ): string {
    const computation = computeOverlay(snapshot, card);

    return createDeterministicId(
      'overlay-fingerprint',
      ...resolveDeterministicParts(
        snapshot,
        card,
        computation.normalizedOverlay,
        computation.context,
        computation.timing,
        computation.divergence,
        computation.decay,
      ),
    );
  }

  public resolveDoctrineRole(
    snapshot: RunStateSnapshot,
    card: CardDefinition,
  ): DoctrineRole {
    return resolveDoctrineRole(snapshot, card);
  }

  public resolveWeightedTags(
    snapshot: RunStateSnapshot,
    card: CardDefinition,
  ): readonly WeightedTagContribution[] {
    const context = buildResolutionContext(snapshot, card);
    const overlay = normalizeOverlayState(card, context);
    return resolveWeightedTags(card, context, overlay);
  }

  public resolveMetadataTags(
    snapshot: RunStateSnapshot,
    card: CardDefinition,
  ): readonly string[] {
    const computation = computeOverlay(snapshot, card);
    return computation.tags.tags.filter((tag) => tag.includes(':'));
  }

  public resolveCompositeDoctrineScore(
    snapshot: RunStateSnapshot,
    card: CardDefinition,
  ): number {
    const context = buildResolutionContext(snapshot, card);
    return resolveDoctrineCompositeScore(snapshot, card, context);
  }

  public resolveTimingClass(
    snapshot: RunStateSnapshot,
    card: CardDefinition,
  ): readonly TimingClass[] {
    const context = buildResolutionContext(snapshot, card);
    const overlay = normalizeOverlayState(card, context);
    return resolveTiming(card, overlay).canonicalTiming;
  }

  public resolveDecayTicksRemaining(
    snapshot: RunStateSnapshot,
    card: CardDefinition,
  ): number | null {
    const context = buildResolutionContext(snapshot, card);
    const overlay = normalizeOverlayState(card, context);
    const timing = resolveTiming(card, overlay);

    return resolveDecay(card, context, timing).decayTicksRemaining;
  }

  public resolveDivergencePotential(
    snapshot: RunStateSnapshot,
    card: CardDefinition,
  ): DivergencePotential {
    const context = buildResolutionContext(snapshot, card);
    const overlay = normalizeOverlayState(card, context);
    const effect = buildEffectSummary(card);

    return resolveDivergence(
      snapshot,
      card,
      context,
      overlay,
      effect,
    ).potential;
  }

  // ─── Batch overlay resolution ───────────────────────────────────────────────

  /**
   * Resolve overlays for an entire set of card definitions at once.
   * Returns a map from definition ID to CardInstance.
   * The AI hand-building and deck-composition systems call this once per tick
   * to materialize the full hand rather than doing N individual resolve() calls.
   */
  public resolveBatch(
    snapshot: RunStateSnapshot,
    cards: readonly CardDefinition[],
  ): ReadonlyMap<string, CardInstance> {
    const result = new Map<string, CardInstance>();
    for (const card of cards) {
      result.set(card.id, this.resolve(snapshot, card));
    }
    return result;
  }

  /**
   * Resolve overlays and return a sorted array — high-divergence first.
   * Used by the UX hand-sort system to surface the most volatile cards
   * to the player's attention zone.
   */
  public resolveBatchSortedByDivergence(
    snapshot: RunStateSnapshot,
    cards: readonly CardDefinition[],
  ): readonly CardInstance[] {
    const instances = cards.map((c) => this.resolve(snapshot, c));
    return instances.slice().sort((a, b) => {
      const rank: Record<DivergencePotential, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
      return (rank[b.divergencePotential] ?? 0) - (rank[a.divergencePotential] ?? 0);
    });
  }

  /**
   * Resolve overlays and return a sorted array — lowest resolved cost first.
   * UX hand-sort: "cheapest plays" mode for players under cash pressure.
   */
  public resolveBatchSortedByCost(
    snapshot: RunStateSnapshot,
    cards: readonly CardDefinition[],
  ): readonly CardInstance[] {
    const instances = cards.map((c) => this.resolve(snapshot, c));
    return instances.slice().sort((a, b) => a.cost - b.cost);
  }

  // ─── Doctrine profiles ─────────────────────────────────────────────────────

  /**
   * Build a rich doctrine profile for a single card under the current snapshot.
   * The drama director and NPC commentary systems consume this to produce
   * contextually accurate reactions to the card the player just chose.
   */
  public buildCardDoctrineProfile(
    snapshot: RunStateSnapshot,
    card: CardDefinition,
  ): CardDoctrineProfile {
    const context = buildResolutionContext(snapshot, card);
    const overlay = normalizeOverlayState(card, context);
    const effect = buildEffectSummary(card);
    const divergence = resolveDivergence(snapshot, card, context, overlay, effect);
    const timing = resolveTiming(card, overlay);
    const doctrineRole = resolveDoctrineRole(snapshot, card);
    const weightedTags = resolveWeightedTags(card, context, overlay);

    const costDisplay = round3(overlay.costModifier * card.baseCost);
    const effectModifierDisplay = round3(overlay.effectModifier);

    return Object.freeze({
      definitionId: card.id,
      mode: snapshot.mode,
      doctrineRole,
      divergencePotential: divergence.potential,
      divergenceScore: round3(divergence.score),
      dominantDivergenceAxis: divergence.dominantAxis,
      costModifier: overlay.costModifier,
      effectModifier: overlay.effectModifier,
      costDisplay,
      effectModifierDisplay,
      canonicalTiming: timing.canonicalTiming,
      targetingOverride: overlay.targetingOverride ?? null,
      topWeightedTags: weightedTags
        .slice()
        .sort((a, b) => b.finalWeight - a.finalWeight)
        .slice(0, 5),
      drawPileSizeContext: context.drawPileSize,
      deckEntropyContext: context.deckEntropy,
      pressureBandContext: context.pressureBand,
      tensionBandContext: context.tensionBand,
      doctrineRoleLabel: resolveDoctrineRoleLabel(doctrineRole),
      narrativeSummary: buildDoctrineNarrativeSummary(doctrineRole, divergence.potential, snapshot.mode),
    });
  }

  /**
   * Build doctrine profiles for a batch of cards.
   * Returns profiles in the order of the input cards array.
   */
  public buildBatchDoctrineProfiles(
    snapshot: RunStateSnapshot,
    cards: readonly CardDefinition[],
  ): readonly CardDoctrineProfile[] {
    return cards.map((c) => this.buildCardDoctrineProfile(snapshot, c));
  }

  // ─── Deck doctrine profile ─────────────────────────────────────────────────

  /**
   * Build a deck-level doctrine summary across all cards in a set.
   * Used by the AI planner and by the "deck vitality" UX panel to show the
   * player their current hand composition and strategic posture.
   */
  public buildDeckDoctrineProfile(
    snapshot: RunStateSnapshot,
    cards: readonly CardDefinition[],
  ): DeckDoctrineProfile {
    const profiles = this.buildBatchDoctrineProfiles(snapshot, cards);

    const roleCounts: Partial<Record<DoctrineRole, number>> = {};
    let totalEffectModifier = 0;
    let totalCostModifier = 0;
    let highDivCount = 0;
    let mediumDivCount = 0;
    let lowDivCount = 0;

    for (const p of profiles) {
      roleCounts[p.doctrineRole] = (roleCounts[p.doctrineRole] ?? 0) + 1;
      totalEffectModifier += p.effectModifier;
      totalCostModifier += p.costModifier;
      if (p.divergencePotential === 'HIGH') highDivCount++;
      else if (p.divergencePotential === 'MEDIUM') mediumDivCount++;
      else lowDivCount++;
    }

    const count = Math.max(1, profiles.length);
    const avgEffectModifier = round3(totalEffectModifier / count);
    const avgCostModifier = round3(totalCostModifier / count);
    const volatilityScore01 = round3((highDivCount * 1 + mediumDivCount * 0.5) / count);

    const roleEntries = Object.entries(roleCounts) as [DoctrineRole, number][];
    roleEntries.sort(([, a], [, b]) => b - a);
    const dominantRole = roleEntries[0]?.[0] ?? 'GENERALIST';

    return Object.freeze({
      mode: snapshot.mode,
      cardCount: profiles.length,
      dominantDoctrineRole: dominantRole,
      roleCounts: Object.freeze(Object.fromEntries(roleEntries)),
      avgEffectModifier,
      avgCostModifier,
      highDivergenceCount: highDivCount,
      mediumDivergenceCount: mediumDivCount,
      lowDivergenceCount: lowDivCount,
      volatilityScore01,
      volatilityLabel: resolveVolatilityLabel(volatilityScore01),
      deckEntropyContext: snapshot.cards.deckEntropy || DEFAULT_DECK_ENTROPY,
      drawPileSizeContext: snapshot.cards.drawPileSize || DEFAULT_DRAW_PILE_SIZE,
      archetypeLabel: resolveDoctrineRoleLabel(dominantRole),
    });
  }

  // ─── Overlay health ────────────────────────────────────────────────────────

  /**
   * Build an overlay health report for a set of cards.
   * Shows which cards are legal in the current mode, which have cost anomalies,
   * and which have divergence risk — used by the debug panel and test harness.
   */
  public buildOverlayHealthReport(
    snapshot: RunStateSnapshot,
    cards: readonly CardDefinition[],
  ): OverlayHealthReport {
    const audits = cards.map((c) => this.inspect(snapshot, c));
    const instances = cards.map((c) => this.resolve(snapshot, c));

    let illegalCount = 0;
    let costAnomalyCount = 0;
    let highDivCount = 0;
    let decayedCount = 0;

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i]!;
      const audit = audits[i]!;
      const instance = instances[i]!;

      // illegal = card's modeLegal doesn't include snapshot.mode
      if (!card.modeLegal.includes(snapshot.mode)) {
        illegalCount++;
      }

      // cost anomaly = resolved cost differs by >20% from base cost
      if (card.baseCost > 0) {
        const ratio = Math.abs(audit.resolvedCost - card.baseCost) / card.baseCost;
        if (ratio > 0.2) costAnomalyCount++;
      }

      if (instance.divergencePotential === 'HIGH') highDivCount++;
      if (instance.decayTicksRemaining !== null && instance.decayTicksRemaining <= 1) decayedCount++;
    }

    const healthRatio01 = round3(
      cards.length === 0 ? 1 : (cards.length - illegalCount - costAnomalyCount) / cards.length,
    );

    return Object.freeze({
      mode: snapshot.mode,
      cardCount: cards.length,
      illegalCount,
      costAnomalyCount,
      highDivergenceCount: highDivCount,
      imminentDecayCount: decayedCount,
      healthRatio01,
      healthLabel: healthRatio01 >= 0.9 ? 'HEALTHY' : healthRatio01 >= 0.7 ? 'WATCH' : 'DEGRADED',
    });
  }

  // ─── Fingerprint batch ────────────────────────────────────────────────────

  /**
   * Resolve deterministic fingerprints for a batch of cards at once.
   * The proof system calls this to snapshot the full hand's materialization
   * state at the start of a turn for later replay verification.
   */
  public resolveBatchFingerprints(
    snapshot: RunStateSnapshot,
    cards: readonly CardDefinition[],
  ): ReadonlyMap<string, string> {
    const result = new Map<string, string>();
    for (const card of cards) {
      result.set(card.id, this.resolveDeterministicFingerprint(snapshot, card));
    }
    return result;
  }

  /**
   * Build a combined hand fingerprint from all card fingerprints.
   * Used as the authoritative overlay state key for replay verification.
   */
  public buildHandFingerprint(
    snapshot: RunStateSnapshot,
    cards: readonly CardDefinition[],
  ): string {
    const prints = cards
      .map((c) => this.resolveDeterministicFingerprint(snapshot, c))
      .sort()
      .join('|');

    // Use the deterministic parts hash pattern from the overlay system
    let hash = 0x811c9dc5;
    for (let i = 0; i < prints.length; i++) {
      hash ^= prints.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return `hand-fp:${(hash >>> 0).toString(16).padStart(8, '0')}`;
  }

  // ─── Display cost helpers ─────────────────────────────────────────────────

  /**
   * Resolve the display cost for a card — 3-decimal precision for UI tooltips.
   * Uses `round3` to format the cost cleanly for player-facing display.
   */
  public resolveDisplayCost(
    snapshot: RunStateSnapshot,
    card: CardDefinition,
  ): number {
    const context = buildResolutionContext(snapshot, card);
    const overlay = normalizeOverlayState(card, context);
    const rawCost = Math.max(0, card.baseCost * overlay.costModifier);
    return round3(rawCost);
  }

  /**
   * Resolve the display effect modifier — 3-decimal precision.
   */
  public resolveDisplayEffectModifier(
    snapshot: RunStateSnapshot,
    card: CardDefinition,
  ): number {
    const context = buildResolutionContext(snapshot, card);
    const overlay = normalizeOverlayState(card, context);
    return round3(overlay.effectModifier);
  }

  /**
   * Build a cost breakdown string for a card.
   * Shows base cost + modifier + resolved cost in a format suitable for
   * UX tooltips and the debug panel.
   */
  public buildCostBreakdownLabel(
    snapshot: RunStateSnapshot,
    card: CardDefinition,
  ): string {
    const context = buildResolutionContext(snapshot, card);
    const overlay = normalizeOverlayState(card, context);
    const displayCost = round3(Math.max(0, card.baseCost * overlay.costModifier));
    const modLabel = overlay.costModifier === 1
      ? 'no modifier'
      : overlay.costModifier > 1
      ? `×${round3(overlay.costModifier)} (increased)`
      : `×${round3(overlay.costModifier)} (discounted)`;
    return `${card.id}: base ${card.baseCost} ${modLabel} → ${displayCost}`;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Exported types for new public APIs
// ═════════════════════════════════════════════════════════════════════════════

export interface CardDoctrineProfile {
  readonly definitionId: string;
  readonly mode: ModeCode;
  readonly doctrineRole: DoctrineRole;
  readonly divergencePotential: DivergencePotential;
  readonly divergenceScore: number;
  readonly dominantDivergenceAxis: DivergenceAxis;
  readonly costModifier: number;
  readonly effectModifier: number;
  readonly costDisplay: number;
  readonly effectModifierDisplay: number;
  readonly canonicalTiming: readonly TimingClass[];
  readonly targetingOverride: Targeting | null;
  readonly topWeightedTags: readonly WeightedTagContribution[];
  readonly drawPileSizeContext: number;
  readonly deckEntropyContext: number;
  readonly pressureBandContext: NumericBand;
  readonly tensionBandContext: NumericBand;
  readonly doctrineRoleLabel: string;
  readonly narrativeSummary: string;
}

export interface DeckDoctrineProfile {
  readonly mode: ModeCode;
  readonly cardCount: number;
  readonly dominantDoctrineRole: DoctrineRole;
  readonly roleCounts: Readonly<Record<string, number>>;
  readonly avgEffectModifier: number;
  readonly avgCostModifier: number;
  readonly highDivergenceCount: number;
  readonly mediumDivergenceCount: number;
  readonly lowDivergenceCount: number;
  readonly volatilityScore01: number;
  readonly volatilityLabel: string;
  readonly deckEntropyContext: number;
  readonly drawPileSizeContext: number;
  readonly archetypeLabel: string;
}

export interface OverlayHealthReport {
  readonly mode: ModeCode;
  readonly cardCount: number;
  readonly illegalCount: number;
  readonly costAnomalyCount: number;
  readonly highDivergenceCount: number;
  readonly imminentDecayCount: number;
  readonly healthRatio01: number;
  readonly healthLabel: 'HEALTHY' | 'WATCH' | 'DEGRADED';
}

// ═════════════════════════════════════════════════════════════════════════════
// Module-level helper functions (consume all types)
// ═════════════════════════════════════════════════════════════════════════════

function resolveDoctrineRoleLabel(role: DoctrineRole): string {
  const labels: Record<DoctrineRole, string> = {
    ECONOMIC_ENGINE: 'Economic Engine',
    TEMPO_ATTACK: 'Tempo Attack',
    COUNTER_WINDOW: 'Counter Window',
    COOP_CONTRACT: 'Coop Contract',
    COOP_RESCUE: 'Coop Rescue',
    PRECISION_GHOST: 'Precision Ghost',
    VARIANCE_DISCIPLINE: 'Variance Discipline',
    PHASE_BOUNDARY: 'Phase Boundary',
    HEAT_RISK: 'Heat Risk',
    SYSTEM_CONVERSION: 'System Conversion',
    GENERALIST: 'Generalist',
  };
  return labels[role] ?? role;
}

function buildDoctrineNarrativeSummary(
  role: DoctrineRole,
  divergence: DivergencePotential,
  mode: ModeCode,
): string {
  const modeLabel = mode === 'solo' ? 'EMPIRE' : mode === 'pvp' ? 'PREDATOR' : mode === 'coop' ? 'SYNDICATE' : 'PHANTOM';
  const divLabel = divergence === 'HIGH' ? 'volatile' : divergence === 'MEDIUM' ? 'dynamic' : 'stable';
  return `[${modeLabel}] ${resolveDoctrineRoleLabel(role)} — ${divLabel} outcome potential.`;
}

function resolveVolatilityLabel(score: number): string {
  if (score >= 0.75) return 'CRITICAL';
  if (score >= 0.5) return 'ELEVATED';
  if (score >= 0.25) return 'MODERATE';
  return 'STABLE';
}

// ═════════════════════════════════════════════════════════════════════════════
// Exported utility functions
// ═════════════════════════════════════════════════════════════════════════════

/**
 * List all defined pressure threshold breakpoints for the overlay system.
 */
export function listPressureThresholds(): Readonly<Record<string, number>> {
  return Object.freeze({
    low: PRESSURE_LOW_THRESHOLD,
    medium: PRESSURE_MEDIUM_THRESHOLD,
    high: PRESSURE_HIGH_THRESHOLD,
    critical: PRESSURE_CRITICAL_THRESHOLD,
  });
}

/**
 * List all tension threshold breakpoints.
 */
export function listTensionThresholds(): Readonly<Record<string, number>> {
  return Object.freeze({
    low: TENSION_LOW_THRESHOLD,
    medium: TENSION_MEDIUM_THRESHOLD,
    high: TENSION_HIGH_THRESHOLD,
    critical: TENSION_CRITICAL_THRESHOLD,
  });
}

/**
 * List shield breakpoints used by the overlay resolver.
 */
export function listShieldThresholds(): Readonly<Record<string, number>> {
  return Object.freeze({
    safe: SHIELD_SAFE_THRESHOLD,
    watch: SHIELD_WATCH_THRESHOLD,
    risk: SHIELD_RISK_THRESHOLD,
    breakpoint: SHIELD_BREAKPOINT_THRESHOLD,
  });
}

/**
 * List trust band thresholds used by the overlay resolver.
 */
export function listTrustThresholds(): Readonly<Record<string, number>> {
  return Object.freeze({
    broken: TRUST_BROKEN_THRESHOLD,
    low: TRUST_LOW_THRESHOLD,
    stable: TRUST_STABLE_THRESHOLD,
    high: TRUST_HIGH_THRESHOLD,
  });
}

/**
 * List threat thresholds used by the overlay resolver.
 */
export function listThreatThresholds(): Readonly<Record<string, number>> {
  return Object.freeze({
    low: THREAT_LOW_THRESHOLD,
    medium: THREAT_MEDIUM_THRESHOLD,
    high: THREAT_HIGH_THRESHOLD,
  });
}

/**
 * List the mode-specific deck score factors used by overlay scoring.
 */
export function listSoloDeckFactors(): Readonly<Record<string, number>> {
  return Object.freeze({
    OPPORTUNITY: SOLO_OPPORTUNITY_FACTOR,
    IPA: SOLO_IPA_FACTOR,
    PRIVILEGED: SOLO_PRIVILEGED_FACTOR,
    SO: SOLO_SO_FACTOR,
    FUBAR: SOLO_FUBAR_FACTOR,
  });
}

/**
 * List PvP-specific deck score factors.
 */
export function listPvpDeckFactors(): Readonly<Record<string, number>> {
  return Object.freeze({
    SABOTAGE: PVP_SABOTAGE_FACTOR,
    COUNTER: PVP_COUNTER_FACTOR,
    BLUFF: PVP_BLUFF_FACTOR,
    BUILD: PVP_BUILD_FACTOR,
  });
}

/**
 * List coop-specific deck score factors.
 */
export function listCoopDeckFactors(): Readonly<Record<string, number>> {
  return Object.freeze({
    AID: COOP_AID_FACTOR,
    RESCUE: COOP_RESCUE_FACTOR,
    TRUST: COOP_TRUST_FACTOR,
    SHARED_OBJECTIVE: COOP_SHARED_OBJECTIVE_FACTOR,
  });
}

/**
 * List ghost-mode deck score factors.
 */
export function listGhostDeckFactors(): Readonly<Record<string, number>> {
  return Object.freeze({
    GHOST: GHOST_GHOST_FACTOR,
    DISCIPLINE: GHOST_DISCIPLINE_FACTOR,
    PRECISION: GHOST_PRECISION_FACTOR,
  });
}

/**
 * List rarity divergence bonuses applied by the overlay scoring system.
 */
export function listRarityDivergenceBonuses(): Readonly<Record<string, number>> {
  return Object.freeze({
    LEGENDARY: LEGENDARY_DIVERGENCE_BONUS,
    RARE: RARE_DIVERGENCE_BONUS,
    UNCOMMON: UNCOMMON_DIVERGENCE_BONUS,
  });
}

/**
 * List the default snapshot context values used when snapshot fields are absent.
 */
export function listOverlayDefaultContextValues(): Readonly<Record<string, number>> {
  return Object.freeze({
    tagWeight: DEFAULT_TAG_WEIGHT,
    freedomTarget: DEFAULT_FREEDOM_TARGET,
    battleBudgetCap: DEFAULT_BATTLE_BUDGET_CAP,
    sharedTreasuryBalance: DEFAULT_SHARED_TREASURY_BALANCE,
    drawPileSize: DEFAULT_DRAW_PILE_SIZE,
    deckEntropy: DEFAULT_DECK_ENTROPY,
    heatModifier: DEFAULT_HEAT_MODIFIER,
  });
}

/**
 * Get the default draw pile size used as a fallback in snapshot context.
 */
export function getDefaultDrawPileSize(): number {
  return DEFAULT_DRAW_PILE_SIZE;
}

/**
 * Get the default deck entropy used as a fallback in snapshot context.
 */
export function getDefaultDeckEntropy(): number {
  return DEFAULT_DECK_ENTROPY;
}

/**
 * Round a cost value to 3-decimal display precision.
 * Wraps the module-internal `round3` function for external consumers.
 */
export function roundCostDisplay(cost: number): number {
  return round3(cost);
}

/**
 * List the decay window constants for each timing window type.
 */
export function listDecayWindowConstants(): Readonly<Record<string, number>> {
  return Object.freeze({
    COUNTER: DECAY_COUNTER_WINDOW,
    RESCUE: DECAY_RESCUE_WINDOW,
    GHOST: DECAY_GHOST_WINDOW,
    HOLD: DECAY_HOLD_WINDOW,
    PHASE_FLOOR: DECAY_PHASE_WINDOW_FLOOR,
  });
}

/**
 * List explicit divergence axis bonuses.
 */
export function listExplicitDivergenceBonuses(): Readonly<Record<string, number>> {
  return Object.freeze({
    HIGH: EXPLICIT_DIVERGENCE_HIGH,
    MEDIUM: EXPLICIT_DIVERGENCE_MEDIUM,
    LOW: EXPLICIT_DIVERGENCE_LOW,
  });
}

/**
 * List phase boundary urgency breakpoints.
 */
export function listPhaseBoundaryUrgency(): Readonly<Record<string, number>> {
  return Object.freeze({
    HIGH: PHASE_BOUNDARY_HIGH_URGENCY,
    MEDIUM: PHASE_BOUNDARY_MEDIUM_URGENCY,
    LOW: PHASE_BOUNDARY_LOW_URGENCY,
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// Module Authority Object
// ═════════════════════════════════════════════════════════════════════════════

export const CARD_OVERLAY_RESOLVER_MODULE_ID =
  'backend.engine.cards.CardOverlayResolver' as const;
export const CARD_OVERLAY_RESOLVER_MODULE_VERSION = '2.0.0' as const;

export const CARD_OVERLAY_RESOLVER_MODULE_AUTHORITY = Object.freeze({
  moduleId: CARD_OVERLAY_RESOLVER_MODULE_ID,
  version: CARD_OVERLAY_RESOLVER_MODULE_VERSION,

  CardOverlayResolver: 'class',

  // Types
  CardDoctrineProfile: 'interface',
  DeckDoctrineProfile: 'interface',
  OverlayHealthReport: 'interface',
  OverlayAuditEnvelope: 'interface',
  WeightedTagContribution: 'interface',
  DoctrineEffectSummary: 'interface',

  // Module constants
  CARD_OVERLAY_RESOLVER_MODULE_ID: 'const',
  CARD_OVERLAY_RESOLVER_MODULE_VERSION: 'const',
  CARD_OVERLAY_RESOLVER_MODULE_AUTHORITY: 'const',

  // Utility functions
  listPressureThresholds: 'function',
  listTensionThresholds: 'function',
  listShieldThresholds: 'function',
  listTrustThresholds: 'function',
  listThreatThresholds: 'function',
  listSoloDeckFactors: 'function',
  listPvpDeckFactors: 'function',
  listCoopDeckFactors: 'function',
  listGhostDeckFactors: 'function',
  listRarityDivergenceBonuses: 'function',
  listOverlayDefaultContextValues: 'function',
  getDefaultDrawPileSize: 'function',
  getDefaultDeckEntropy: 'function',
  roundCostDisplay: 'function',
  listDecayWindowConstants: 'function',
  listExplicitDivergenceBonuses: 'function',
  listPhaseBoundaryUrgency: 'function',
} as const);
