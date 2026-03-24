/*
 * POINT ZERO ONE — BACKEND ENGINE CORE
 * /backend/src/game/engine/cards/DeckComposer.ts
 *
 * Doctrine:
 * - deck composition is backend-owned and doctrine-aware
 * - mode legality must honor both base modeLegal and overlay legality
 * - ordering must remain deterministic, inspectable, and replay-safe
 * - composition helpers must remain additive so existing callers of byMode() still work
 * - deck construction should expose enough structure for future proof, audit, liveops, and chat narration layers
 */

import type {
  CardDefinition,
  CardRarity,
  Counterability,
  DeckType,
  DivergencePotential,
  ModeCode,
  ModeOverlay,
  RunPhase,
  Targeting,
  TimingClass,
} from '../core/GamePrimitives';
import { resolveModeOverlay } from '../core/GamePrimitives';
import { CardRegistry } from './CardRegistry';
import {
  ALL_DECK_TYPES,
  MODE_TAG_WEIGHTS,
  RARITY_WEIGHTS,
  getModeDeckPriority,
  getModeTagWeight,
  scoreCardForMode,
} from './types';

export interface DeckComposerFilters {
  readonly restrictDeckTypes?: readonly DeckType[];
  readonly preferredDeckTypes?: readonly DeckType[];
  readonly excludedDeckTypes?: readonly DeckType[];
  readonly requiredTagsAll?: readonly string[];
  readonly requiredTagsAny?: readonly string[];
  readonly excludedTags?: readonly string[];
  readonly requiredTimingsAny?: readonly TimingClass[];
  readonly requiredTimingsAll?: readonly TimingClass[];
  readonly excludedTimings?: readonly TimingClass[];
  readonly allowedCounterability?: readonly Counterability[];
  readonly allowedTargeting?: readonly Targeting[];
  readonly minRarity?: CardRarity;
  readonly maxRarity?: CardRarity;
  readonly includeAutoResolve?: boolean;
  readonly decayableOnly?: boolean;
  readonly nonDecayableOnly?: boolean;
  readonly maxBaseCost?: number | null;
  readonly minBaseCost?: number | null;
  readonly requireModeExclusive?: boolean;
  readonly requireSharedAcrossAllModes?: boolean;
  readonly educationalTagsAny?: readonly string[];
}

export interface DeckComposerPreferences {
  readonly phase?: RunPhase;
  readonly favorReactionWindows?: boolean;
  readonly favorPhaseBoundary?: boolean;
  readonly favorGhostBenchmark?: boolean;
  readonly favorEndgame?: boolean;
  readonly preferLowCost?: boolean;
  readonly preferHighCost?: boolean;
  readonly preferLowDecay?: boolean;
  readonly preferPersistence?: boolean;
  readonly preferLowHeat?: boolean;
  readonly preferHighHeat?: boolean;
  readonly preferPrecision?: boolean;
  readonly preferDivergence?: boolean;
  readonly preferTrust?: boolean;
  readonly preferAid?: boolean;
  readonly preferSabotage?: boolean;
  readonly preferCounterplay?: boolean;
  readonly preferEconomy?: boolean;
  readonly preferResilience?: boolean;
  readonly preferScale?: boolean;
  readonly preferTempo?: boolean;
  readonly preferCascadeControl?: boolean;
  readonly preferMomentum?: boolean;
  readonly preferredCardIds?: readonly string[];
  readonly excludedCardIds?: readonly string[];
}

export type DeckComposerArchetype =
  | 'GENERAL'
  | 'OPENING'
  | 'REACTION'
  | 'ECONOMY'
  | 'RESILIENCE'
  | 'PRESSURE'
  | 'TRUST'
  | 'PRECISION'
  | 'FINISHER'
  | 'PHASE_BOUNDARY'
  | 'GHOST_BENCHMARK'
  | 'SHARED_OPPORTUNITY';

export type DeckComposerRole =
  | 'EMPIRE_FOUNDATION'
  | 'EMPIRE_COMPOUNDER'
  | 'EMPIRE_FORTIFIER'
  | 'PREDATOR_AGGRESSOR'
  | 'PREDATOR_COUNTERPUNCH'
  | 'PREDATOR_BLUFFER'
  | 'SYNDICATE_TREASURER'
  | 'SYNDICATE_RESCUER'
  | 'SYNDICATE_TRUST_KEEPER'
  | 'PHANTOM_PRECISION'
  | 'PHANTOM_EXPLOITER';

export interface ComposeLimitedDeckInput {
  readonly mode: ModeCode;
  readonly size: number;
  readonly archetype?: DeckComposerArchetype;
  readonly role?: DeckComposerRole;
  readonly filters?: DeckComposerFilters;
  readonly preferences?: DeckComposerPreferences;
  readonly enforceDoctrineQuotas?: boolean;
  readonly includeReasons?: boolean;
  readonly includeExplanations?: boolean;
  readonly legendaryCap?: number | null;
  readonly autoResolveCap?: number | null;
  readonly decayableCap?: number | null;
  readonly hardRequireDeckPresence?: readonly DeckType[];
}

export interface ModeCardScoreBreakdown {
  readonly baseModeScore: number;
  readonly deckPriorityScore: number;
  readonly deckPreferenceScore: number;
  readonly tagScore: number;
  readonly overlayScore: number;
  readonly timingScore: number;
  readonly rarityScore: number;
  readonly costScore: number;
  readonly decayScore: number;
  readonly divergenceScore: number;
  readonly utilityScore: number;
  readonly penaltyScore: number;
  readonly finalScore: number;
}

export interface DeckComposerCardEvaluation {
  readonly definition: CardDefinition;
  readonly mode: ModeCode;
  readonly legal: boolean;
  readonly overlay: ModeOverlay;
  readonly effectiveTargeting: Targeting;
  readonly effectiveDivergence: DivergencePotential;
  readonly effectiveTimingLocks: readonly TimingClass[];
  readonly score: ModeCardScoreBreakdown;
  readonly deckPriority: number;
  readonly effectiveCost: number;
  readonly tagWeightTotal: number;
  readonly explanation: readonly string[];
  readonly bucketLabel: string;
  readonly reactionCard: boolean;
  readonly phaseBoundaryCard: boolean;
  readonly ghostBenchmarkCard: boolean;
  readonly endgameCard: boolean;
  readonly modeExclusive: boolean;
  readonly sharedAcrossAllModes: boolean;
}

export interface DeckComposerCatalogReport {
  readonly mode: ModeCode;
  readonly definitions: readonly CardDefinition[];
  readonly evaluations: readonly DeckComposerCardEvaluation[];
  readonly ids: readonly string[];
  readonly buckets: Readonly<Record<DeckType, readonly CardDefinition[]>>;
  readonly bucketIds: Readonly<Record<DeckType, readonly string[]>>;
  readonly counts: Readonly<Record<DeckType, number>>;
  readonly reactionIds: readonly string[];
  readonly phaseBoundaryIds: readonly string[];
  readonly ghostBenchmarkIds: readonly string[];
  readonly legendaryIds: readonly string[];
  readonly modeExclusiveIds: readonly string[];
  readonly sharedIds: readonly string[];
}

export interface DeckComposerSelectionSummary {
  readonly totalRequested: number;
  readonly totalSelected: number;
  readonly byDeckType: Readonly<Record<DeckType, number>>;
  readonly legendaryCount: number;
  readonly autoResolveCount: number;
  readonly decayableCount: number;
  readonly averageScore: number;
  readonly averageBaseCost: number;
}

export interface EffectMagnitudeProfile {
  readonly cards: readonly CardDefinition[];
  readonly mode: ModeCode;
  readonly magnitudes: readonly number[];
  readonly total: number;
  readonly average: number;
  readonly max: number;
  readonly min: number;
  readonly topThreeIds: readonly string[];
  readonly bottomThreeIds: readonly string[];
}

export interface DeckCompositionResult {
  readonly mode: ModeCode;
  readonly archetype: DeckComposerArchetype;
  readonly role?: DeckComposerRole;
  readonly ids: readonly string[];
  readonly definitions: readonly CardDefinition[];
  readonly evaluations: readonly DeckComposerCardEvaluation[];
  readonly summary: DeckComposerSelectionSummary;
  readonly omittedTopIds: readonly string[];
}

export interface DeckComposerDiagnostics {
  readonly mode: ModeCode;
  readonly modeSummary: ReturnType<CardRegistry['describeModeCatalog']>;
  readonly globalDiagnostics: ReturnType<CardRegistry['diagnostics']>;
  readonly catalog: DeckComposerCatalogReport;
}

interface ModeDoctrine {
  readonly mode: ModeCode;
  readonly defaultArchetype: DeckComposerArchetype;
  readonly deckBias: Readonly<Record<DeckType, number>>;
  readonly timingBias: Readonly<Record<TimingClass, number>>;
  readonly costBias: number;
  readonly decayBias: number;
  readonly reactionBias: number;
  readonly phaseBias: number;
  readonly ghostBias: number;
  readonly endBias: number;
  readonly precisionBias: number;
  readonly divergenceBias: number;
  readonly heatBias: number;
  readonly trustBias: number;
  readonly aidBias: number;
  readonly counterBias: number;
  readonly sabotageBias: number;
  readonly resilienceBias: number;
  readonly economyBias: number;
  readonly cascadeBias: number;
  readonly sharedOpportunityBias: number;
  readonly quotas: Readonly<Record<DeckType, number>>;
  readonly requiredDecks: readonly DeckType[];
  readonly softCaps: Readonly<{
    legendary: number;
    autoResolve: number;
    decayable: number;
  }>;
  readonly preferredEducationalTags: readonly string[];
}

interface ArchetypePreset {
  readonly archetype: DeckComposerArchetype;
  readonly filters?: DeckComposerFilters;
  readonly preferences?: DeckComposerPreferences;
  readonly quotas?: Partial<Record<DeckType, number>>;
  readonly requiredDecks?: readonly DeckType[];
}

interface RolePreset {
  readonly role: DeckComposerRole;
  readonly mode: ModeCode;
  readonly archetype: DeckComposerArchetype;
  readonly filters?: DeckComposerFilters;
  readonly preferences?: DeckComposerPreferences;
  readonly quotas?: Partial<Record<DeckType, number>>;
  readonly requiredDecks?: readonly DeckType[];
}

const EMPTY_STRING_ARRAY: readonly string[] = Object.freeze([]);
const EMPTY_TIMING_ARRAY: readonly TimingClass[] = Object.freeze([]);
const EMPTY_DECKTYPE_ARRAY: readonly DeckType[] = Object.freeze([]);
const REACTION_TIMINGS: readonly TimingClass[] = Object.freeze([
  'FATE',
  'CTR',
  'RES',
  'AID',
  'CAS',
  'PSK',
  'END',
]);
const ECONOMY_TAGS: readonly string[] = Object.freeze([
  'liquidity',
  'income',
  'scale',
  'momentum',
]);
const RESILIENCE_TAGS: readonly string[] = Object.freeze([
  'resilience',
  'precision',
  'cascade',
]);
const PREDATOR_TAGS: readonly string[] = Object.freeze([
  'tempo',
  'sabotage',
  'counter',
  'variance',
]);
const SYNDICATE_TAGS: readonly string[] = Object.freeze([
  'trust',
  'aid',
  'resilience',
  'cascade',
]);
const PHANTOM_TAGS: readonly string[] = Object.freeze([
  'precision',
  'divergence',
  'tempo',
  'variance',
]);
const MODE_EXCLUSIVE_DECKS: Readonly<Record<ModeCode, readonly DeckType[]>> = Object.freeze({
  solo: Object.freeze(['DISCIPLINE'] as const),
  pvp: Object.freeze(['SABOTAGE', 'COUNTER', 'BLUFF'] as const),
  coop: Object.freeze(['AID', 'RESCUE', 'TRUST'] as const),
  ghost: Object.freeze(['GHOST'] as const),
});
const ARCHETYPE_PRIORITY_ORDER: readonly DeckComposerArchetype[] = Object.freeze([
  'GENERAL',
  'OPENING',
  'REACTION',
  'ECONOMY',
  'RESILIENCE',
  'PRESSURE',
  'TRUST',
  'PRECISION',
  'FINISHER',
  'PHASE_BOUNDARY',
  'GHOST_BENCHMARK',
  'SHARED_OPPORTUNITY',
]);

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }

  if (value > max) {
    return max;
  }

  return value;
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }

    seen.add(value);
    output.push(value);
  }

  return Object.freeze(output);
}

function uniqueTimings(values: readonly TimingClass[]): readonly TimingClass[] {
  const seen = new Set<TimingClass>();
  const output: TimingClass[] = [];

  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }

    seen.add(value);
    output.push(value);
  }

  return Object.freeze(output);
}

function freezeBucketIds(input: Record<DeckType, string[]>): Readonly<Record<DeckType, readonly string[]>> {
  return Object.freeze({
    OPPORTUNITY: Object.freeze([...input.OPPORTUNITY]),
    IPA: Object.freeze([...input.IPA]),
    FUBAR: Object.freeze([...input.FUBAR]),
    MISSED_OPPORTUNITY: Object.freeze([...input.MISSED_OPPORTUNITY]),
    PRIVILEGED: Object.freeze([...input.PRIVILEGED]),
    SO: Object.freeze([...input.SO]),
    SABOTAGE: Object.freeze([...input.SABOTAGE]),
    COUNTER: Object.freeze([...input.COUNTER]),
    AID: Object.freeze([...input.AID]),
    RESCUE: Object.freeze([...input.RESCUE]),
    DISCIPLINE: Object.freeze([...input.DISCIPLINE]),
    TRUST: Object.freeze([...input.TRUST]),
    BLUFF: Object.freeze([...input.BLUFF]),
    GHOST: Object.freeze([...input.GHOST]),
  });
}

function freezeBucketDefinitions(
  input: Record<DeckType, CardDefinition[]>,
): Readonly<Record<DeckType, readonly CardDefinition[]>> {
  return Object.freeze({
    OPPORTUNITY: Object.freeze([...input.OPPORTUNITY]),
    IPA: Object.freeze([...input.IPA]),
    FUBAR: Object.freeze([...input.FUBAR]),
    MISSED_OPPORTUNITY: Object.freeze([...input.MISSED_OPPORTUNITY]),
    PRIVILEGED: Object.freeze([...input.PRIVILEGED]),
    SO: Object.freeze([...input.SO]),
    SABOTAGE: Object.freeze([...input.SABOTAGE]),
    COUNTER: Object.freeze([...input.COUNTER]),
    AID: Object.freeze([...input.AID]),
    RESCUE: Object.freeze([...input.RESCUE]),
    DISCIPLINE: Object.freeze([...input.DISCIPLINE]),
    TRUST: Object.freeze([...input.TRUST]),
    BLUFF: Object.freeze([...input.BLUFF]),
    GHOST: Object.freeze([...input.GHOST]),
  });
}

function createEmptyIdBuckets(): Record<DeckType, string[]> {
  return {
    OPPORTUNITY: [],
    IPA: [],
    FUBAR: [],
    MISSED_OPPORTUNITY: [],
    PRIVILEGED: [],
    SO: [],
    SABOTAGE: [],
    COUNTER: [],
    AID: [],
    RESCUE: [],
    DISCIPLINE: [],
    TRUST: [],
    BLUFF: [],
    GHOST: [],
  };
}

function createEmptyDefinitionBuckets(): Record<DeckType, CardDefinition[]> {
  return {
    OPPORTUNITY: [],
    IPA: [],
    FUBAR: [],
    MISSED_OPPORTUNITY: [],
    PRIVILEGED: [],
    SO: [],
    SABOTAGE: [],
    COUNTER: [],
    AID: [],
    RESCUE: [],
    DISCIPLINE: [],
    TRUST: [],
    BLUFF: [],
    GHOST: [],
  };
}

function createEmptyCountBuckets(): Record<DeckType, number> {
  return {
    OPPORTUNITY: 0,
    IPA: 0,
    FUBAR: 0,
    MISSED_OPPORTUNITY: 0,
    PRIVILEGED: 0,
    SO: 0,
    SABOTAGE: 0,
    COUNTER: 0,
    AID: 0,
    RESCUE: 0,
    DISCIPLINE: 0,
    TRUST: 0,
    BLUFF: 0,
    GHOST: 0,
  };
}

function compareDeckType(a: DeckType, b: DeckType): number {
  return ALL_DECK_TYPES.indexOf(a) - ALL_DECK_TYPES.indexOf(b);
}

function compareString(a: string, b: string): number {
  return a.localeCompare(b);
}

function rarityRank(rarity: CardRarity): number {
  return RARITY_WEIGHTS[rarity] ?? 0;
}

function rarityMeetsMin(rarity: CardRarity, min?: CardRarity): boolean {
  if (!min) {
    return true;
  }

  return rarityRank(rarity) >= rarityRank(min);
}

function rarityMeetsMax(rarity: CardRarity, max?: CardRarity): boolean {
  if (!max) {
    return true;
  }

  return rarityRank(rarity) <= rarityRank(max);
}

function includesAllTags(card: CardDefinition, tags: readonly string[]): boolean {
  return tags.every((tag) => card.tags.includes(tag));
}

function includesAnyTags(card: CardDefinition, tags: readonly string[]): boolean {
  return tags.some((tag) => card.tags.includes(tag));
}

function includesAnyTiming(card: CardDefinition, timings: readonly TimingClass[]): boolean {
  return timings.some((timing) => card.timingClass.includes(timing));
}

function includesAllTimings(card: CardDefinition, timings: readonly TimingClass[]): boolean {
  return timings.every((timing) => card.timingClass.includes(timing));
}

function buildEffectMagnitude(card: CardDefinition, overlay: ModeOverlay): number {
  const effect = card.baseEffect;
  const sum =
    Math.abs(effect.cashDelta ?? 0) +
    Math.abs(effect.debtDelta ?? 0) +
    Math.abs(effect.incomeDelta ?? 0) +
    Math.abs(effect.expenseDelta ?? 0) +
    Math.abs(effect.shieldDelta ?? 0) +
    Math.abs(effect.heatDelta ?? 0) +
    Math.abs(effect.trustDelta ?? 0) +
    Math.abs(effect.treasuryDelta ?? 0) +
    Math.abs(effect.battleBudgetDelta ?? 0) +
    Math.abs(effect.holdChargeDelta ?? 0) +
    Math.abs(effect.counterIntelDelta ?? 0) +
    Math.abs(effect.timeDeltaMs ?? 0) / 1_000 +
    Math.abs(effect.divergenceDelta ?? 0) * 100 +
    (effect.injectCards?.length ?? 0) * 250 +
    (effect.exhaustCards?.length ?? 0) * 125 +
    (effect.grantBadges?.length ?? 0) * 100 +
    (effect.cascadeTag ? 200 : 0) +
    (effect.namedActionId ? 300 : 0);

  return round4(sum * overlay.effectModifier);
}

function isReactionTiming(timing: TimingClass): boolean {
  return REACTION_TIMINGS.includes(timing);
}

function isModeExclusive(mode: ModeCode, card: CardDefinition): boolean {
  return card.modeLegal.length === 1 && card.modeLegal[0] === mode;
}

function isSharedAcrossAllModes(card: CardDefinition): boolean {
  return card.modeLegal.length === 4;
}

function defaultLegendaryCap(size: number): number {
  if (size <= 8) {
    return 1;
  }

  if (size <= 20) {
    return 2;
  }

  return 3;
}

function defaultAutoResolveCap(size: number): number {
  if (size <= 10) {
    return 2;
  }

  if (size <= 20) {
    return 3;
  }

  return 4;
}

function defaultDecayableCap(size: number): number {
  if (size <= 8) {
    return 4;
  }

  if (size <= 20) {
    return 8;
  }

  return 12;
}

function normalizeSize(size: number): number {
  if (!Number.isFinite(size) || size <= 0) {
    return 0;
  }

  return Math.floor(size);
}

function mergeStringLists(...lists: (readonly string[] | undefined)[]): readonly string[] {
  const values: string[] = [];

  for (const list of lists) {
    if (!list) {
      continue;
    }

    values.push(...list);
  }

  return uniqueStrings(values);
}

function mergeTimingLists(...lists: (readonly TimingClass[] | undefined)[]): readonly TimingClass[] {
  const values: TimingClass[] = [];

  for (const list of lists) {
    if (!list) {
      continue;
    }

    values.push(...list);
  }

  return uniqueTimings(values);
}

function buildModeDoctrine(mode: ModeCode): ModeDoctrine {
  switch (mode) {
    case 'solo':
      return {
        mode,
        defaultArchetype: 'GENERAL',
        deckBias: Object.freeze({
          OPPORTUNITY: 22,
          IPA: 18,
          FUBAR: -12,
          MISSED_OPPORTUNITY: -10,
          PRIVILEGED: 10,
          SO: 9,
          SABOTAGE: -30,
          COUNTER: -20,
          AID: -30,
          RESCUE: -30,
          DISCIPLINE: 15,
          TRUST: -30,
          BLUFF: -24,
          GHOST: -24,
        }),
        timingBias: Object.freeze({
          PRE: 9,
          POST: 4,
          FATE: 7,
          CTR: -10,
          RES: -12,
          AID: -12,
          GBM: -10,
          CAS: 6,
          PHZ: 11,
          PSK: 8,
          END: 6,
          ANY: 5,
        }),
        costBias: 7,
        decayBias: 5,
        reactionBias: 7,
        phaseBias: 11,
        ghostBias: -8,
        endBias: 6,
        precisionBias: 6,
        divergenceBias: 2,
        heatBias: -2,
        trustBias: -10,
        aidBias: -12,
        counterBias: -10,
        sabotageBias: -20,
        resilienceBias: 8,
        economyBias: 11,
        cascadeBias: 5,
        sharedOpportunityBias: 8,
        quotas: Object.freeze({
          OPPORTUNITY: 0.26,
          IPA: 0.18,
          FUBAR: 0.03,
          MISSED_OPPORTUNITY: 0.03,
          PRIVILEGED: 0.10,
          SO: 0.10,
          SABOTAGE: 0,
          COUNTER: 0,
          AID: 0,
          RESCUE: 0,
          DISCIPLINE: 0.18,
          TRUST: 0,
          BLUFF: 0,
          GHOST: 0,
        }),
        requiredDecks: Object.freeze(['OPPORTUNITY', 'IPA', 'DISCIPLINE']),
        softCaps: Object.freeze({ legendary: 2, autoResolve: 2, decayable: 8 }),
        preferredEducationalTags: Object.freeze([
          'Cashflow > paper gains',
          'Liquidity > vanity',
          'Leverage is a tool, not a trait',
          'Opportunity cost is always real',
        ]),
      };
    case 'pvp':
      return {
        mode,
        defaultArchetype: 'PRESSURE',
        deckBias: Object.freeze({
          OPPORTUNITY: 3,
          IPA: -4,
          FUBAR: -6,
          MISSED_OPPORTUNITY: -8,
          PRIVILEGED: 8,
          SO: 5,
          SABOTAGE: 24,
          COUNTER: 20,
          AID: -30,
          RESCUE: -30,
          DISCIPLINE: 8,
          TRUST: -30,
          BLUFF: 14,
          GHOST: -30,
        }),
        timingBias: Object.freeze({
          PRE: 6,
          POST: 8,
          FATE: 5,
          CTR: 14,
          RES: -12,
          AID: -12,
          GBM: -12,
          CAS: 8,
          PHZ: -12,
          PSK: 12,
          END: 8,
          ANY: 4,
        }),
        costBias: 4,
        decayBias: 3,
        reactionBias: 13,
        phaseBias: -6,
        ghostBias: -10,
        endBias: 9,
        precisionBias: 7,
        divergenceBias: 1,
        heatBias: 4,
        trustBias: -14,
        aidBias: -14,
        counterBias: 15,
        sabotageBias: 18,
        resilienceBias: 5,
        economyBias: 3,
        cascadeBias: 9,
        sharedOpportunityBias: 3,
        quotas: Object.freeze({
          OPPORTUNITY: 0.12,
          IPA: 0.05,
          FUBAR: 0.03,
          MISSED_OPPORTUNITY: 0.03,
          PRIVILEGED: 0.08,
          SO: 0.06,
          SABOTAGE: 0.30,
          COUNTER: 0.22,
          AID: 0,
          RESCUE: 0,
          DISCIPLINE: 0.07,
          TRUST: 0,
          BLUFF: 0.14,
          GHOST: 0,
        }),
        requiredDecks: Object.freeze(['SABOTAGE', 'COUNTER']),
        softCaps: Object.freeze({ legendary: 2, autoResolve: 1, decayable: 9 }),
        preferredEducationalTags: Object.freeze([
          'Preparation beats reaction',
          'Debt is a weapon and a trap',
          'Leverage is a tool, not a trait',
        ]),
      };
    case 'coop':
      return {
        mode,
        defaultArchetype: 'TRUST',
        deckBias: Object.freeze({
          OPPORTUNITY: 6,
          IPA: 5,
          FUBAR: -8,
          MISSED_OPPORTUNITY: -6,
          PRIVILEGED: 6,
          SO: 5,
          SABOTAGE: -30,
          COUNTER: -16,
          AID: 22,
          RESCUE: 20,
          DISCIPLINE: 5,
          TRUST: 24,
          BLUFF: -30,
          GHOST: -30,
        }),
        timingBias: Object.freeze({
          PRE: 5,
          POST: 6,
          FATE: 5,
          CTR: -8,
          RES: 14,
          AID: 13,
          GBM: -10,
          CAS: 8,
          PHZ: -8,
          PSK: 7,
          END: 7,
          ANY: 5,
        }),
        costBias: 6,
        decayBias: 4,
        reactionBias: 11,
        phaseBias: -5,
        ghostBias: -9,
        endBias: 7,
        precisionBias: 4,
        divergenceBias: 1,
        heatBias: -1,
        trustBias: 18,
        aidBias: 15,
        counterBias: -6,
        sabotageBias: -20,
        resilienceBias: 10,
        economyBias: 7,
        cascadeBias: 8,
        sharedOpportunityBias: 6,
        quotas: Object.freeze({
          OPPORTUNITY: 0.12,
          IPA: 0.10,
          FUBAR: 0.03,
          MISSED_OPPORTUNITY: 0.03,
          PRIVILEGED: 0.06,
          SO: 0.06,
          SABOTAGE: 0,
          COUNTER: 0,
          AID: 0.22,
          RESCUE: 0.18,
          DISCIPLINE: 0.04,
          TRUST: 0.16,
          BLUFF: 0,
          GHOST: 0,
        }),
        requiredDecks: Object.freeze(['AID', 'RESCUE', 'TRUST']),
        softCaps: Object.freeze({ legendary: 2, autoResolve: 2, decayable: 8 }),
        preferredEducationalTags: Object.freeze([
          'Your network is your net worth',
          'Preparation beats reaction',
          'Cashflow > paper gains',
        ]),
      };
    case 'ghost':
      return {
        mode,
        defaultArchetype: 'PRECISION',
        deckBias: Object.freeze({
          OPPORTUNITY: 6,
          IPA: 4,
          FUBAR: -8,
          MISSED_OPPORTUNITY: -6,
          PRIVILEGED: 4,
          SO: 6,
          SABOTAGE: -30,
          COUNTER: -20,
          AID: -30,
          RESCUE: -30,
          DISCIPLINE: 22,
          TRUST: -30,
          BLUFF: -30,
          GHOST: 28,
        }),
        timingBias: Object.freeze({
          PRE: 6,
          POST: 7,
          FATE: 4,
          CTR: -12,
          RES: -12,
          AID: -12,
          GBM: 16,
          CAS: 8,
          PHZ: -12,
          PSK: 8,
          END: 7,
          ANY: 5,
        }),
        costBias: 5,
        decayBias: 7,
        reactionBias: 8,
        phaseBias: -4,
        ghostBias: 20,
        endBias: 7,
        precisionBias: 16,
        divergenceBias: 18,
        heatBias: 0,
        trustBias: -10,
        aidBias: -10,
        counterBias: -10,
        sabotageBias: -16,
        resilienceBias: 6,
        economyBias: 4,
        cascadeBias: 6,
        sharedOpportunityBias: 5,
        quotas: Object.freeze({
          OPPORTUNITY: 0.10,
          IPA: 0.06,
          FUBAR: 0.03,
          MISSED_OPPORTUNITY: 0.03,
          PRIVILEGED: 0.05,
          SO: 0.08,
          SABOTAGE: 0,
          COUNTER: 0,
          AID: 0,
          RESCUE: 0,
          DISCIPLINE: 0.28,
          TRUST: 0,
          BLUFF: 0,
          GHOST: 0.37,
        }),
        requiredDecks: Object.freeze(['GHOST', 'DISCIPLINE']),
        softCaps: Object.freeze({ legendary: 2, autoResolve: 2, decayable: 10 }),
        preferredEducationalTags: Object.freeze([
          'The record shows what reality was',
          'Opportunity cost is always real',
          'Preparation beats reaction',
        ]),
      };
    default:
      return assertNeverMode(mode);
  }
}

function buildArchetypePreset(mode: ModeCode, archetype: DeckComposerArchetype): ArchetypePreset {
  switch (archetype) {
    case 'GENERAL':
      return { archetype };
    case 'OPENING':
      return {
        archetype,
        preferences: {
          phase: 'FOUNDATION',
          preferLowCost: true,
          preferEconomy: true,
          preferTempo: mode === 'pvp',
          favorPhaseBoundary: mode === 'solo',
        },
      };
    case 'REACTION':
      return {
        archetype,
        filters: {
          requiredTimingsAny: REACTION_TIMINGS,
        },
        preferences: {
          favorReactionWindows: true,
          preferResilience: true,
          preferCounterplay: mode === 'pvp',
          preferAid: mode === 'coop',
        },
      };
    case 'ECONOMY':
      return {
        archetype,
        filters: {
          requiredTagsAny: ECONOMY_TAGS,
          excludedDeckTypes: mode === 'pvp' ? (['SABOTAGE', 'COUNTER'] as const) : undefined,
        },
        preferences: {
          preferEconomy: true,
          preferScale: true,
          preferLowHeat: mode === 'solo',
          preferPersistence: true,
        },
      };
    case 'RESILIENCE':
      return {
        archetype,
        filters: {
          requiredTagsAny: RESILIENCE_TAGS,
        },
        preferences: {
          preferResilience: true,
          preferPrecision: true,
          preferCascadeControl: true,
          favorReactionWindows: true,
        },
      };
    case 'PRESSURE':
      return {
        archetype,
        filters: {
          requiredTagsAny: mode === 'pvp' ? PREDATOR_TAGS : ['tempo', 'cascade', 'heat'],
        },
        preferences: {
          preferSabotage: mode === 'pvp',
          preferCounterplay: mode === 'pvp',
          preferTempo: true,
          preferHighHeat: mode === 'pvp',
          favorReactionWindows: true,
        },
      };
    case 'TRUST':
      return {
        archetype,
        filters: {
          requiredTagsAny: SYNDICATE_TAGS,
        },
        preferences: {
          preferTrust: true,
          preferAid: true,
          preferResilience: true,
          favorReactionWindows: true,
        },
      };
    case 'PRECISION':
      return {
        archetype,
        filters: {
          requiredTagsAny: PHANTOM_TAGS,
        },
        preferences: {
          preferPrecision: true,
          preferDivergence: mode === 'ghost',
          preferLowDecay: true,
          preferPersistence: true,
        },
      };
    case 'FINISHER':
      return {
        archetype,
        preferences: {
          phase: 'SOVEREIGNTY',
          favorEndgame: true,
          preferHighCost: true,
          preferTempo: true,
          preferCounterplay: mode === 'pvp',
          preferDivergence: mode === 'ghost',
        },
      };
    case 'PHASE_BOUNDARY':
      return {
        archetype,
        filters: {
          requiredTimingsAny: ['PHZ'],
        },
        preferences: {
          phase: 'ESCALATION',
          favorPhaseBoundary: true,
          preferEconomy: true,
          preferResilience: true,
        },
      };
    case 'GHOST_BENCHMARK':
      return {
        archetype,
        filters: {
          requiredTimingsAny: ['GBM'],
          restrictDeckTypes: ['GHOST', 'DISCIPLINE', 'OPPORTUNITY', 'SO'],
        },
        preferences: {
          favorGhostBenchmark: true,
          preferPrecision: true,
          preferDivergence: true,
          preferTempo: true,
        },
      };
    case 'SHARED_OPPORTUNITY':
      return {
        archetype,
        filters: {
          restrictDeckTypes: ['OPPORTUNITY'],
          excludedTimings: ['PHZ'],
        },
        preferences: {
          preferEconomy: true,
          preferScale: true,
          preferLowHeat: true,
          preferPersistence: true,
        },
      };
    default:
      return assertNeverArchetype(archetype);
  }
}

function buildRolePreset(role: DeckComposerRole): RolePreset {
  switch (role) {
    case 'EMPIRE_FOUNDATION':
      return {
        role,
        mode: 'solo',
        archetype: 'OPENING',
        filters: {
          preferredDeckTypes: ['OPPORTUNITY', 'DISCIPLINE', 'SO'],
          excludedDeckTypes: ['FUBAR', 'MISSED_OPPORTUNITY'],
        },
        preferences: {
          phase: 'FOUNDATION',
          preferLowCost: true,
          preferEconomy: true,
          preferScale: true,
        },
        quotas: {
          OPPORTUNITY: 0.34,
          DISCIPLINE: 0.20,
          SO: 0.14,
          IPA: 0.16,
        },
        requiredDecks: ['OPPORTUNITY', 'DISCIPLINE'],
      };
    case 'EMPIRE_COMPOUNDER':
      return {
        role,
        mode: 'solo',
        archetype: 'ECONOMY',
        filters: {
          preferredDeckTypes: ['IPA', 'OPPORTUNITY', 'PRIVILEGED'],
          requiredTagsAny: ['income', 'scale'],
        },
        preferences: {
          preferEconomy: true,
          preferScale: true,
          preferPersistence: true,
        },
        quotas: {
          IPA: 0.28,
          OPPORTUNITY: 0.28,
          PRIVILEGED: 0.12,
          DISCIPLINE: 0.12,
        },
        requiredDecks: ['OPPORTUNITY', 'IPA'],
      };
    case 'EMPIRE_FORTIFIER':
      return {
        role,
        mode: 'solo',
        archetype: 'RESILIENCE',
        filters: {
          preferredDeckTypes: ['DISCIPLINE', 'SO', 'PRIVILEGED'],
          requiredTagsAny: ['resilience', 'cascade', 'precision'],
        },
        preferences: {
          preferResilience: true,
          preferCascadeControl: true,
          favorReactionWindows: true,
        },
        quotas: {
          DISCIPLINE: 0.24,
          SO: 0.20,
          OPPORTUNITY: 0.18,
          IPA: 0.12,
        },
        requiredDecks: ['DISCIPLINE', 'SO'],
      };
    case 'PREDATOR_AGGRESSOR':
      return {
        role,
        mode: 'pvp',
        archetype: 'PRESSURE',
        filters: {
          preferredDeckTypes: ['SABOTAGE', 'BLUFF', 'COUNTER'],
          requiredTagsAny: ['sabotage', 'tempo', 'variance'],
        },
        preferences: {
          preferSabotage: true,
          preferTempo: true,
          preferHighHeat: true,
        },
        quotas: {
          SABOTAGE: 0.38,
          COUNTER: 0.18,
          BLUFF: 0.18,
          PRIVILEGED: 0.08,
        },
        requiredDecks: ['SABOTAGE', 'COUNTER'],
      };
    case 'PREDATOR_COUNTERPUNCH':
      return {
        role,
        mode: 'pvp',
        archetype: 'REACTION',
        filters: {
          preferredDeckTypes: ['COUNTER', 'SABOTAGE', 'DISCIPLINE'],
          requiredTimingsAny: ['CTR', 'CAS', 'PSK', 'POST'],
        },
        preferences: {
          favorReactionWindows: true,
          preferCounterplay: true,
          preferPrecision: true,
        },
        quotas: {
          COUNTER: 0.34,
          SABOTAGE: 0.22,
          BLUFF: 0.12,
          DISCIPLINE: 0.08,
        },
        requiredDecks: ['COUNTER'],
      };
    case 'PREDATOR_BLUFFER':
      return {
        role,
        mode: 'pvp',
        archetype: 'PRESSURE',
        filters: {
          preferredDeckTypes: ['BLUFF', 'SABOTAGE', 'COUNTER'],
          requiredTagsAny: ['tempo', 'variance'],
        },
        preferences: {
          preferTempo: true,
          preferSabotage: true,
          preferHighHeat: false,
          preferLowCost: true,
        },
        quotas: {
          BLUFF: 0.30,
          SABOTAGE: 0.26,
          COUNTER: 0.18,
          OPPORTUNITY: 0.10,
        },
        requiredDecks: ['BLUFF', 'COUNTER'],
      };
    case 'SYNDICATE_TREASURER':
      return {
        role,
        mode: 'coop',
        archetype: 'TRUST',
        filters: {
          preferredDeckTypes: ['AID', 'TRUST', 'OPPORTUNITY', 'IPA'],
          requiredTagsAny: ['trust', 'aid', 'income'],
        },
        preferences: {
          preferTrust: true,
          preferAid: true,
          preferEconomy: true,
        },
        quotas: {
          AID: 0.28,
          TRUST: 0.20,
          OPPORTUNITY: 0.14,
          IPA: 0.12,
          RESCUE: 0.12,
        },
        requiredDecks: ['AID', 'TRUST'],
      };
    case 'SYNDICATE_RESCUER':
      return {
        role,
        mode: 'coop',
        archetype: 'REACTION',
        filters: {
          preferredDeckTypes: ['RESCUE', 'AID', 'TRUST'],
          requiredTimingsAny: ['RES', 'AID', 'CAS', 'PSK'],
        },
        preferences: {
          favorReactionWindows: true,
          preferAid: true,
          preferResilience: true,
        },
        quotas: {
          RESCUE: 0.30,
          AID: 0.22,
          TRUST: 0.18,
          SO: 0.08,
        },
        requiredDecks: ['RESCUE', 'AID'],
      };
    case 'SYNDICATE_TRUST_KEEPER':
      return {
        role,
        mode: 'coop',
        archetype: 'TRUST',
        filters: {
          preferredDeckTypes: ['TRUST', 'AID', 'RESCUE'],
          requiredTagsAny: ['trust', 'aid'],
        },
        preferences: {
          preferTrust: true,
          preferAid: true,
          preferPrecision: true,
          favorReactionWindows: true,
        },
        quotas: {
          TRUST: 0.30,
          AID: 0.24,
          RESCUE: 0.16,
          DISCIPLINE: 0.06,
        },
        requiredDecks: ['TRUST', 'AID'],
      };
    case 'PHANTOM_PRECISION':
      return {
        role,
        mode: 'ghost',
        archetype: 'PRECISION',
        filters: {
          preferredDeckTypes: ['DISCIPLINE', 'GHOST', 'SO'],
          requiredTagsAny: ['precision', 'divergence'],
        },
        preferences: {
          preferPrecision: true,
          preferDivergence: true,
          preferLowDecay: true,
          favorGhostBenchmark: true,
        },
        quotas: {
          DISCIPLINE: 0.30,
          GHOST: 0.34,
          SO: 0.10,
        },
        requiredDecks: ['DISCIPLINE', 'GHOST'],
      };
    case 'PHANTOM_EXPLOITER':
      return {
        role,
        mode: 'ghost',
        archetype: 'GHOST_BENCHMARK',
        filters: {
          preferredDeckTypes: ['GHOST', 'DISCIPLINE', 'OPPORTUNITY'],
          requiredTimingsAny: ['GBM', 'PRE'],
        },
        preferences: {
          favorGhostBenchmark: true,
          preferDivergence: true,
          preferTempo: true,
        },
        quotas: {
          GHOST: 0.42,
          DISCIPLINE: 0.24,
          OPPORTUNITY: 0.12,
        },
        requiredDecks: ['GHOST'],
      };
    default:
      return assertNeverRole(role);
  }
}

function assertNeverMode(mode: never): never {
  throw new Error(`Unhandled mode: ${String(mode)}`);
}

function assertNeverArchetype(archetype: never): never {
  throw new Error(`Unhandled archetype: ${String(archetype)}`);
}

function assertNeverRole(role: never): never {
  throw new Error(`Unhandled role: ${String(role)}`);
}

function mergeFilters(
  left?: DeckComposerFilters,
  right?: DeckComposerFilters,
): DeckComposerFilters | undefined {
  if (!left && !right) {
    return undefined;
  }

  return {
    restrictDeckTypes: (right?.restrictDeckTypes ?? left?.restrictDeckTypes),
    preferredDeckTypes: (right?.preferredDeckTypes ?? left?.preferredDeckTypes),
    excludedDeckTypes: uniqueStrings([
      ...(left?.excludedDeckTypes ?? EMPTY_DECKTYPE_ARRAY),
      ...(right?.excludedDeckTypes ?? EMPTY_DECKTYPE_ARRAY),
    ]) as readonly DeckType[],
    requiredTagsAll: mergeStringLists(left?.requiredTagsAll, right?.requiredTagsAll),
    requiredTagsAny: mergeStringLists(left?.requiredTagsAny, right?.requiredTagsAny),
    excludedTags: mergeStringLists(left?.excludedTags, right?.excludedTags),
    requiredTimingsAny: mergeTimingLists(left?.requiredTimingsAny, right?.requiredTimingsAny),
    requiredTimingsAll: mergeTimingLists(left?.requiredTimingsAll, right?.requiredTimingsAll),
    excludedTimings: mergeTimingLists(left?.excludedTimings, right?.excludedTimings),
    allowedCounterability: right?.allowedCounterability ?? left?.allowedCounterability,
    allowedTargeting: right?.allowedTargeting ?? left?.allowedTargeting,
    minRarity: right?.minRarity ?? left?.minRarity,
    maxRarity: right?.maxRarity ?? left?.maxRarity,
    includeAutoResolve: right?.includeAutoResolve ?? left?.includeAutoResolve,
    decayableOnly: right?.decayableOnly ?? left?.decayableOnly,
    nonDecayableOnly: right?.nonDecayableOnly ?? left?.nonDecayableOnly,
    maxBaseCost: right?.maxBaseCost ?? left?.maxBaseCost,
    minBaseCost: right?.minBaseCost ?? left?.minBaseCost,
    requireModeExclusive: right?.requireModeExclusive ?? left?.requireModeExclusive,
    requireSharedAcrossAllModes:
      right?.requireSharedAcrossAllModes ?? left?.requireSharedAcrossAllModes,
    educationalTagsAny: mergeStringLists(left?.educationalTagsAny, right?.educationalTagsAny),
  };
}

function mergePreferences(
  left?: DeckComposerPreferences,
  right?: DeckComposerPreferences,
): DeckComposerPreferences | undefined {
  if (!left && !right) {
    return undefined;
  }

  return {
    phase: right?.phase ?? left?.phase,
    favorReactionWindows: right?.favorReactionWindows ?? left?.favorReactionWindows,
    favorPhaseBoundary: right?.favorPhaseBoundary ?? left?.favorPhaseBoundary,
    favorGhostBenchmark: right?.favorGhostBenchmark ?? left?.favorGhostBenchmark,
    favorEndgame: right?.favorEndgame ?? left?.favorEndgame,
    preferLowCost: right?.preferLowCost ?? left?.preferLowCost,
    preferHighCost: right?.preferHighCost ?? left?.preferHighCost,
    preferLowDecay: right?.preferLowDecay ?? left?.preferLowDecay,
    preferPersistence: right?.preferPersistence ?? left?.preferPersistence,
    preferLowHeat: right?.preferLowHeat ?? left?.preferLowHeat,
    preferHighHeat: right?.preferHighHeat ?? left?.preferHighHeat,
    preferPrecision: right?.preferPrecision ?? left?.preferPrecision,
    preferDivergence: right?.preferDivergence ?? left?.preferDivergence,
    preferTrust: right?.preferTrust ?? left?.preferTrust,
    preferAid: right?.preferAid ?? left?.preferAid,
    preferSabotage: right?.preferSabotage ?? left?.preferSabotage,
    preferCounterplay: right?.preferCounterplay ?? left?.preferCounterplay,
    preferEconomy: right?.preferEconomy ?? left?.preferEconomy,
    preferResilience: right?.preferResilience ?? left?.preferResilience,
    preferScale: right?.preferScale ?? left?.preferScale,
    preferTempo: right?.preferTempo ?? left?.preferTempo,
    preferCascadeControl: right?.preferCascadeControl ?? left?.preferCascadeControl,
    preferMomentum: right?.preferMomentum ?? left?.preferMomentum,
    preferredCardIds: mergeStringLists(left?.preferredCardIds, right?.preferredCardIds),
    excludedCardIds: mergeStringLists(left?.excludedCardIds, right?.excludedCardIds),
  };
}

function mergeQuotas(
  doctrine: Readonly<Record<DeckType, number>>,
  overrides?: Partial<Record<DeckType, number>>,
): Readonly<Record<DeckType, number>> {
  const merged: Record<DeckType, number> = createEmptyCountBuckets();

  for (const deckType of ALL_DECK_TYPES) {
    const base = doctrine[deckType] ?? 0;
    const override = overrides?.[deckType];
    merged[deckType] = clamp(override ?? base, 0, 1);
  }

  return Object.freeze(merged);
}

export class DeckComposer {
  public constructor(
    private readonly registry: CardRegistry = new CardRegistry(),
  ) {}

  public byMode(mode: ModeCode): string[] {
    return this.byModeDefinitions(mode).map((card) => card.id);
  }

  public byModeDefinitions(mode: ModeCode): CardDefinition[] {
    return [...this.byModeDetailed(mode).definitions];
  }

  public byModeBuckets(mode: ModeCode): Record<DeckType, string[]> {
    const report = this.byModeDetailed(mode);
    const output = createEmptyIdBuckets();

    for (const deckType of ALL_DECK_TYPES) {
      output[deckType] = [...report.bucketIds[deckType]];
    }

    return output;
  }

  public composeLimitedDeck(mode: ModeCode, size: number): string[] {
    return [...this.composeLimitedDeckDetailed({ mode, size }).ids];
  }

  public composeLimitedDeckDefinitions(mode: ModeCode, size: number): CardDefinition[] {
    return [...this.composeLimitedDeckDetailed({ mode, size }).definitions];
  }

  public contains(mode: ModeCode, definitionId: string): boolean {
    const card = this.registry.get(definitionId);

    if (!card) {
      return false;
    }

    return this.isModeLegal(card, mode);
  }

  public byModeDetailed(
    mode: ModeCode,
    options?: {
      readonly filters?: DeckComposerFilters;
      readonly preferences?: DeckComposerPreferences;
    },
  ): DeckComposerCatalogReport {
    return this.buildCatalog(mode, options?.filters, options?.preferences);
  }

  public byModeDefinitionBuckets(
    mode: ModeCode,
    options?: {
      readonly filters?: DeckComposerFilters;
      readonly preferences?: DeckComposerPreferences;
    },
  ): Record<DeckType, CardDefinition[]> {
    const report = this.buildCatalog(mode, options?.filters, options?.preferences);
    const output = createEmptyDefinitionBuckets();

    for (const deckType of ALL_DECK_TYPES) {
      output[deckType] = [...report.buckets[deckType]];
    }

    return output;
  }

  public byModeScoreMap(
    mode: ModeCode,
    options?: {
      readonly filters?: DeckComposerFilters;
      readonly preferences?: DeckComposerPreferences;
    },
  ): Record<string, number> {
    const report = this.buildCatalog(mode, options?.filters, options?.preferences);
    const output: Record<string, number> = {};

    for (const evaluation of report.evaluations) {
      output[evaluation.definition.id] = evaluation.score.finalScore;
    }

    return output;
  }

  public composeDoctrineDeck(
    mode: ModeCode,
    size: number,
    archetype: DeckComposerArchetype = 'GENERAL',
  ): DeckCompositionResult {
    return this.composeLimitedDeckDetailed({ mode, size, archetype });
  }

  public composeOpeningDeck(mode: ModeCode, size: number): DeckCompositionResult {
    return this.composeLimitedDeckDetailed({ mode, size, archetype: 'OPENING' });
  }

  public composeReactionDeck(mode: ModeCode, size: number): DeckCompositionResult {
    return this.composeLimitedDeckDetailed({ mode, size, archetype: 'REACTION' });
  }

  public composeEconomicDeck(mode: ModeCode, size: number): DeckCompositionResult {
    return this.composeLimitedDeckDetailed({ mode, size, archetype: 'ECONOMY' });
  }

  public composeResilienceDeck(mode: ModeCode, size: number): DeckCompositionResult {
    return this.composeLimitedDeckDetailed({ mode, size, archetype: 'RESILIENCE' });
  }

  public composePressureDeck(mode: ModeCode, size: number): DeckCompositionResult {
    return this.composeLimitedDeckDetailed({ mode, size, archetype: 'PRESSURE' });
  }

  public composeTrustDeck(mode: ModeCode, size: number): DeckCompositionResult {
    return this.composeLimitedDeckDetailed({ mode, size, archetype: 'TRUST' });
  }

  public composePrecisionDeck(mode: ModeCode, size: number): DeckCompositionResult {
    return this.composeLimitedDeckDetailed({ mode, size, archetype: 'PRECISION' });
  }

  public composeFinisherDeck(mode: ModeCode, size: number): DeckCompositionResult {
    return this.composeLimitedDeckDetailed({ mode, size, archetype: 'FINISHER' });
  }

  public composePhaseBoundaryDeck(mode: ModeCode, size: number): DeckCompositionResult {
    return this.composeLimitedDeckDetailed({
      mode,
      size,
      archetype: 'PHASE_BOUNDARY',
      filters: {
        requiredTimingsAny: ['PHZ'],
      },
      preferences: {
        favorPhaseBoundary: true,
        phase: 'ESCALATION',
      },
      enforceDoctrineQuotas: false,
    });
  }

  public composeLegendBenchmarkDeck(size: number): DeckCompositionResult {
    return this.composeLimitedDeckDetailed({
      mode: 'ghost',
      size,
      archetype: 'GHOST_BENCHMARK',
    });
  }

  public composeSharedOpportunityDeck(mode: ModeCode, size: number): DeckCompositionResult {
    return this.composeLimitedDeckDetailed({
      mode,
      size,
      archetype: 'SHARED_OPPORTUNITY',
      filters: {
        restrictDeckTypes: ['OPPORTUNITY'],
        excludedTimings: ['PHZ'],
      },
      enforceDoctrineQuotas: false,
    });
  }

  public composeRoleDeck(
    role: DeckComposerRole,
    size: number,
    overrides?: {
      readonly filters?: DeckComposerFilters;
      readonly preferences?: DeckComposerPreferences;
    },
  ): DeckCompositionResult {
    const preset = buildRolePreset(role);

    return this.composeLimitedDeckDetailed({
      mode: preset.mode,
      size,
      role,
      archetype: preset.archetype,
      filters: mergeFilters(preset.filters, overrides?.filters),
      preferences: mergePreferences(preset.preferences, overrides?.preferences),
      hardRequireDeckPresence: preset.requiredDecks,
      enforceDoctrineQuotas: true,
    });
  }

  public analyzeCard(
    mode: ModeCode,
    definitionId: string,
    options?: {
      readonly filters?: DeckComposerFilters;
      readonly preferences?: DeckComposerPreferences;
    },
  ): DeckComposerCardEvaluation | null {
    const card = this.registry.get(definitionId);

    if (!card) {
      return null;
    }

    const evaluation = this.evaluateCard(card, mode, options?.filters, options?.preferences);
    return evaluation.legal ? evaluation : null;
  }

  public explainCard(
    mode: ModeCode,
    definitionId: string,
    options?: {
      readonly filters?: DeckComposerFilters;
      readonly preferences?: DeckComposerPreferences;
    },
  ): string[] {
    const evaluation = this.analyzeCard(mode, definitionId, options);
    return evaluation ? [...evaluation.explanation] : [];
  }

  public countByModeDeck(mode: ModeCode): Record<DeckType, number> {
    const report = this.buildCatalog(mode);
    return {
      OPPORTUNITY: report.counts.OPPORTUNITY,
      IPA: report.counts.IPA,
      FUBAR: report.counts.FUBAR,
      MISSED_OPPORTUNITY: report.counts.MISSED_OPPORTUNITY,
      PRIVILEGED: report.counts.PRIVILEGED,
      SO: report.counts.SO,
      SABOTAGE: report.counts.SABOTAGE,
      COUNTER: report.counts.COUNTER,
      AID: report.counts.AID,
      RESCUE: report.counts.RESCUE,
      DISCIPLINE: report.counts.DISCIPLINE,
      TRUST: report.counts.TRUST,
      BLUFF: report.counts.BLUFF,
      GHOST: report.counts.GHOST,
    };
  }

  public listModeExclusive(mode: ModeCode): string[] {
    return [...this.registry.listModeExclusive(mode).map((card) => card.id)];
  }

  public listReactionCards(mode: ModeCode): string[] {
    return [...this.registry.listReactionCardsForMode(mode).map((card) => card.id)];
  }

  public summarizeMode(mode: ModeCode): DeckComposerCatalogReport {
    return this.buildCatalog(mode);
  }

  public diagnostics(mode: ModeCode): DeckComposerDiagnostics {
    const catalog = this.buildCatalog(mode);

    return {
      mode,
      modeSummary: this.registry.describeModeCatalog(mode),
      globalDiagnostics: this.registry.diagnostics(),
      catalog,
    };
  }

  public composeLimitedDeckDetailed(input: ComposeLimitedDeckInput): DeckCompositionResult {
    const size = normalizeSize(input.size);
    const doctrine = buildModeDoctrine(input.mode);
    const rolePreset = input.role ? buildRolePreset(input.role) : undefined;
    const archetypePreset = buildArchetypePreset(
      input.mode,
      input.archetype ?? rolePreset?.archetype ?? doctrine.defaultArchetype,
    );
    const filters = mergeFilters(
      mergeFilters(rolePreset?.filters, archetypePreset.filters),
      input.filters,
    );
    const preferences = mergePreferences(
      mergePreferences(rolePreset?.preferences, archetypePreset.preferences),
      input.preferences,
    );
    const catalog = this.buildCatalog(input.mode, filters, preferences);

    if (size <= 0) {
      return {
        mode: input.mode,
        archetype: archetypePreset.archetype,
        role: input.role,
        ids: Object.freeze([]),
        definitions: Object.freeze([]),
        evaluations: Object.freeze([]),
        summary: {
          totalRequested: 0,
          totalSelected: 0,
          byDeckType: Object.freeze(createEmptyCountBuckets()),
          legendaryCount: 0,
          autoResolveCount: 0,
          decayableCount: 0,
          averageScore: 0,
          averageBaseCost: 0,
        },
        omittedTopIds: Object.freeze(catalog.ids.slice(0, 12)),
      };
    }

    const quotas = mergeQuotas(
      doctrine.quotas,
      rolePreset?.quotas ?? archetypePreset.quotas,
    );
    const requiredDecks = uniqueStrings([
      ...doctrine.requiredDecks,
      ...(archetypePreset.requiredDecks ?? EMPTY_DECKTYPE_ARRAY),
      ...(rolePreset?.requiredDecks ?? EMPTY_DECKTYPE_ARRAY),
      ...(input.hardRequireDeckPresence ?? EMPTY_DECKTYPE_ARRAY),
    ]) as readonly DeckType[];
    const legendaryCap = input.legendaryCap ?? doctrine.softCaps.legendary ?? defaultLegendaryCap(size);
    const autoResolveCap = input.autoResolveCap ?? doctrine.softCaps.autoResolve ?? defaultAutoResolveCap(size);
    const decayableCap = input.decayableCap ?? doctrine.softCaps.decayable ?? defaultDecayableCap(size);
    const enforceDoctrineQuotas = input.enforceDoctrineQuotas ?? true;
    const selected = new Set<string>();
    const picked: DeckComposerCardEvaluation[] = [];
    let legendaryCount = 0;
    let autoResolveCount = 0;
    let decayableCount = 0;

    const tryPush = (evaluation: DeckComposerCardEvaluation): boolean => {
      if (picked.length >= size) {
        return false;
      }

      if (selected.has(evaluation.definition.id)) {
        return false;
      }

      if (legendaryCount >= legendaryCap && evaluation.definition.rarity === 'LEGENDARY') {
        return false;
      }

      if (autoResolveCount >= autoResolveCap && evaluation.definition.autoResolve) {
        return false;
      }

      if (decayableCount >= decayableCap && evaluation.definition.decayTicks !== null) {
        return false;
      }

      selected.add(evaluation.definition.id);
      picked.push(evaluation);

      if (evaluation.definition.rarity === 'LEGENDARY') {
        legendaryCount += 1;
      }

      if (evaluation.definition.autoResolve) {
        autoResolveCount += 1;
      }

      if (evaluation.definition.decayTicks !== null) {
        decayableCount += 1;
      }

      return true;
    };

    for (const deckType of requiredDecks) {
      const candidate = catalog.evaluations.find(
        (evaluation) => evaluation.definition.deckType === deckType,
      );

      if (candidate) {
        tryPush(candidate);
      }
    }

    if (enforceDoctrineQuotas) {
      const targets = this.allocateDeckTargets(quotas, size, requiredDecks);

      for (const deckType of ALL_DECK_TYPES) {
        const targetCount = targets[deckType];
        if (targetCount <= 0) {
          continue;
        }

        const bucket = catalog.evaluations.filter(
          (evaluation) => evaluation.definition.deckType === deckType,
        );

        for (const evaluation of bucket) {
          const currentCount = picked.filter((entry) => entry.definition.deckType === deckType).length;
          if (currentCount >= targetCount) {
            break;
          }

          tryPush(evaluation);
        }
      }
    }

    for (const preferredId of preferences?.preferredCardIds ?? EMPTY_STRING_ARRAY) {
      const candidate = catalog.evaluations.find((evaluation) => evaluation.definition.id === preferredId);
      if (candidate) {
        tryPush(candidate);
      }
    }

    for (const evaluation of catalog.evaluations) {
      if (picked.length >= size) {
        break;
      }

      tryPush(evaluation);
    }

    const pickedIds = Object.freeze(picked.map((evaluation) => evaluation.definition.id));
    const pickedDefinitions = Object.freeze(picked.map((evaluation) => evaluation.definition));
    const omittedTopIds = Object.freeze(
      catalog.ids.filter((id) => !selected.has(id)).slice(0, Math.max(12, size)),
    );
    const byDeckType = createEmptyCountBuckets();
    let scoreSum = 0;
    let baseCostSum = 0;

    for (const evaluation of picked) {
      byDeckType[evaluation.definition.deckType] += 1;
      scoreSum += evaluation.score.finalScore;
      baseCostSum += evaluation.definition.baseCost;
    }

    return {
      mode: input.mode,
      archetype: archetypePreset.archetype,
      role: input.role,
      ids: pickedIds,
      definitions: pickedDefinitions,
      evaluations: Object.freeze([...picked]),
      summary: {
        totalRequested: size,
        totalSelected: picked.length,
        byDeckType: Object.freeze(byDeckType),
        legendaryCount,
        autoResolveCount,
        decayableCount,
        averageScore: picked.length > 0 ? round4(scoreSum / picked.length) : 0,
        averageBaseCost: picked.length > 0 ? round4(baseCostSum / picked.length) : 0,
      },
      omittedTopIds,
    };
  }

  private buildCatalog(
    mode: ModeCode,
    filters?: DeckComposerFilters,
    preferences?: DeckComposerPreferences,
  ): DeckComposerCatalogReport {
    const doctrine = buildModeDoctrine(mode);
    const allCards = this.registry.all();
    const evaluations: DeckComposerCardEvaluation[] = [];

    for (const card of allCards) {
      const evaluation = this.evaluateCard(card, mode, filters, preferences, doctrine);
      if (evaluation.legal) {
        evaluations.push(evaluation);
      }
    }

    evaluations.sort((left, right) => this.compareEvaluations(left, right, mode));

    const ids = evaluations.map((evaluation) => evaluation.definition.id);
    const definitions = evaluations.map((evaluation) => evaluation.definition);
    const definitionBuckets = createEmptyDefinitionBuckets();
    const idBuckets = createEmptyIdBuckets();
    const counts = createEmptyCountBuckets();
    const reactionIds: string[] = [];
    const phaseBoundaryIds: string[] = [];
    const ghostBenchmarkIds: string[] = [];
    const legendaryIds: string[] = [];
    const modeExclusiveIds: string[] = [];
    const sharedIds: string[] = [];

    for (const evaluation of evaluations) {
      const card = evaluation.definition;
      definitionBuckets[card.deckType].push(card);
      idBuckets[card.deckType].push(card.id);
      counts[card.deckType] += 1;

      if (evaluation.reactionCard) {
        reactionIds.push(card.id);
      }

      if (evaluation.phaseBoundaryCard) {
        phaseBoundaryIds.push(card.id);
      }

      if (evaluation.ghostBenchmarkCard) {
        ghostBenchmarkIds.push(card.id);
      }

      if (card.rarity === 'LEGENDARY') {
        legendaryIds.push(card.id);
      }

      if (evaluation.modeExclusive) {
        modeExclusiveIds.push(card.id);
      }

      if (evaluation.sharedAcrossAllModes) {
        sharedIds.push(card.id);
      }
    }

    const catalog: DeckComposerCatalogReport = {
      mode,
      definitions: Object.freeze([...definitions]),
      evaluations: Object.freeze([...evaluations]),
      ids: Object.freeze([...ids]),
      buckets: freezeBucketDefinitions(definitionBuckets),
      bucketIds: freezeBucketIds(idBuckets),
      counts: Object.freeze(counts),
      reactionIds: Object.freeze(reactionIds),
      phaseBoundaryIds: Object.freeze(phaseBoundaryIds),
      ghostBenchmarkIds: Object.freeze(ghostBenchmarkIds),
      legendaryIds: Object.freeze(legendaryIds),
      modeExclusiveIds: Object.freeze(modeExclusiveIds),
      sharedIds: Object.freeze(sharedIds),
    };

    return catalog;
  }

  private evaluateCard(
    card: CardDefinition,
    mode: ModeCode,
    filters?: DeckComposerFilters,
    preferences?: DeckComposerPreferences,
    doctrine: ModeDoctrine = buildModeDoctrine(mode),
  ): DeckComposerCardEvaluation {
    const overlay = resolveModeOverlay(card, mode);

    if (!this.isModeLegal(card, mode)) {
      return this.illegalEvaluation(card, mode, overlay, 'mode legality rejected card');
    }

    if (!this.matchesFilters(card, mode, filters)) {
      return this.illegalEvaluation(card, mode, overlay, 'filters rejected card');
    }

    if ((preferences?.excludedCardIds ?? EMPTY_STRING_ARRAY).includes(card.id)) {
      return this.illegalEvaluation(card, mode, overlay, 'preferences excluded card id');
    }

    const effectiveTargeting = overlay.targetingOverride ?? card.targeting;
    const effectiveDivergence = overlay.divergencePotential ?? 'LOW';
    const effectiveTimingLocks = uniqueTimings(overlay.timingLock ?? EMPTY_TIMING_ARRAY);
    const reactionCard = card.timingClass.some((timing) => isReactionTiming(timing));
    const phaseBoundaryCard = card.timingClass.includes('PHZ');
    const ghostBenchmarkCard = card.timingClass.includes('GBM');
    const endgameCard = card.timingClass.includes('END');
    const modeExclusive = isModeExclusive(mode, card);
    const sharedAcrossAllModes = isSharedAcrossAllModes(card);
    const deckPriority = getModeDeckPriority(mode, card.deckType);
    const effectiveCost = round4(card.baseCost * overlay.costModifier);
    const tagWeightTotal = round4(
      card.tags.reduce((sum, tag) => {
        return sum + getModeTagWeight(mode, tag) + (overlay.tagWeights[tag] ?? 0);
      }, 0),
    );

    const baseModeScore = scoreCardForMode(card, mode);
    const deckPriorityScore = round4((1000 - deckPriority) / 25);
    const deckPreferenceScore = this.scoreDeckPreference(card, mode, doctrine, preferences);
    const tagScore = this.scoreTags(card, mode, doctrine, preferences, overlay);
    const overlayScore = this.scoreOverlay(card, mode, overlay, doctrine);
    const timingScore = this.scoreTiming(card, mode, doctrine, preferences);
    const rarityScore = this.scoreRarity(card, mode, doctrine);
    const costScore = this.scoreCost(card, effectiveCost, doctrine, preferences);
    const decayScore = this.scoreDecay(card, doctrine, preferences);
    const divergenceScore = this.scoreDivergence(card, effectiveDivergence, doctrine, preferences);
    const utilityScore = this.scoreUtility(card, mode, doctrine, preferences, reactionCard, phaseBoundaryCard, ghostBenchmarkCard, endgameCard);
    const penaltyScore = this.scorePenalty(card, doctrine, preferences, overlay);
    const finalScore = round4(
      baseModeScore +
        deckPriorityScore +
        deckPreferenceScore +
        tagScore +
        overlayScore +
        timingScore +
        rarityScore +
        costScore +
        decayScore +
        divergenceScore +
        utilityScore -
        penaltyScore,
    );

    return {
      definition: card,
      mode,
      legal: true,
      overlay,
      effectiveTargeting,
      effectiveDivergence,
      effectiveTimingLocks,
      score: {
        baseModeScore: round4(baseModeScore),
        deckPriorityScore,
        deckPreferenceScore,
        tagScore,
        overlayScore,
        timingScore,
        rarityScore,
        costScore,
        decayScore,
        divergenceScore,
        utilityScore,
        penaltyScore,
        finalScore,
      },
      deckPriority,
      effectiveCost,
      tagWeightTotal,
      explanation: Object.freeze(
        this.buildExplanation(
          card,
          mode,
          doctrine,
          preferences,
          overlay,
          {
            baseModeScore,
            deckPriorityScore,
            deckPreferenceScore,
            tagScore,
            overlayScore,
            timingScore,
            rarityScore,
            costScore,
            decayScore,
            divergenceScore,
            utilityScore,
            penaltyScore,
            finalScore,
          },
          reactionCard,
          phaseBoundaryCard,
          ghostBenchmarkCard,
          endgameCard,
          modeExclusive,
          sharedAcrossAllModes,
        ),
      ),
      bucketLabel: this.deriveBucketLabel(card, mode),
      reactionCard,
      phaseBoundaryCard,
      ghostBenchmarkCard,
      endgameCard,
      modeExclusive,
      sharedAcrossAllModes,
    };
  }

  private illegalEvaluation(
    card: CardDefinition,
    mode: ModeCode,
    overlay: ModeOverlay,
    reason: string,
  ): DeckComposerCardEvaluation {
    return {
      definition: card,
      mode,
      legal: false,
      overlay,
      effectiveTargeting: overlay.targetingOverride ?? card.targeting,
      effectiveDivergence: overlay.divergencePotential ?? 'LOW',
      effectiveTimingLocks: uniqueTimings(overlay.timingLock ?? EMPTY_TIMING_ARRAY),
      score: {
        baseModeScore: 0,
        deckPriorityScore: 0,
        deckPreferenceScore: 0,
        tagScore: 0,
        overlayScore: 0,
        timingScore: 0,
        rarityScore: 0,
        costScore: 0,
        decayScore: 0,
        divergenceScore: 0,
        utilityScore: 0,
        penaltyScore: 0,
        finalScore: Number.NEGATIVE_INFINITY,
      },
      deckPriority: 999,
      effectiveCost: round4(card.baseCost * overlay.costModifier),
      tagWeightTotal: 0,
      explanation: Object.freeze([reason]),
      bucketLabel: 'ILLEGAL',
      reactionCard: false,
      phaseBoundaryCard: false,
      ghostBenchmarkCard: false,
      endgameCard: false,
      modeExclusive: false,
      sharedAcrossAllModes: false,
    };
  }

  private matchesFilters(
    card: CardDefinition,
    mode: ModeCode,
    filters?: DeckComposerFilters,
  ): boolean {
    if (!filters) {
      return true;
    }

    if (filters.restrictDeckTypes && filters.restrictDeckTypes.length > 0) {
      if (!filters.restrictDeckTypes.includes(card.deckType)) {
        return false;
      }
    }

    if (filters.excludedDeckTypes && filters.excludedDeckTypes.length > 0) {
      if (filters.excludedDeckTypes.includes(card.deckType)) {
        return false;
      }
    }

    if (filters.requiredTagsAll && filters.requiredTagsAll.length > 0) {
      if (!includesAllTags(card, filters.requiredTagsAll)) {
        return false;
      }
    }

    if (filters.requiredTagsAny && filters.requiredTagsAny.length > 0) {
      if (!includesAnyTags(card, filters.requiredTagsAny)) {
        return false;
      }
    }

    if (filters.excludedTags && filters.excludedTags.length > 0) {
      if (includesAnyTags(card, filters.excludedTags)) {
        return false;
      }
    }

    if (filters.requiredTimingsAny && filters.requiredTimingsAny.length > 0) {
      if (!includesAnyTiming(card, filters.requiredTimingsAny)) {
        return false;
      }
    }

    if (filters.requiredTimingsAll && filters.requiredTimingsAll.length > 0) {
      if (!includesAllTimings(card, filters.requiredTimingsAll)) {
        return false;
      }
    }

    if (filters.excludedTimings && filters.excludedTimings.length > 0) {
      if (includesAnyTiming(card, filters.excludedTimings)) {
        return false;
      }
    }

    if (filters.allowedCounterability && filters.allowedCounterability.length > 0) {
      if (!filters.allowedCounterability.includes(card.counterability)) {
        return false;
      }
    }

    if (filters.allowedTargeting && filters.allowedTargeting.length > 0) {
      const targeting = resolveModeOverlay(card, mode).targetingOverride ?? card.targeting;
      if (!filters.allowedTargeting.includes(targeting)) {
        return false;
      }
    }

    if (!rarityMeetsMin(card.rarity, filters.minRarity)) {
      return false;
    }

    if (!rarityMeetsMax(card.rarity, filters.maxRarity)) {
      return false;
    }

    if (filters.includeAutoResolve === false && card.autoResolve) {
      return false;
    }

    if (filters.decayableOnly && card.decayTicks === null) {
      return false;
    }

    if (filters.nonDecayableOnly && card.decayTicks !== null) {
      return false;
    }

    if (filters.maxBaseCost !== null && filters.maxBaseCost !== undefined) {
      if (card.baseCost > filters.maxBaseCost) {
        return false;
      }
    }

    if (filters.minBaseCost !== null && filters.minBaseCost !== undefined) {
      if (card.baseCost < filters.minBaseCost) {
        return false;
      }
    }

    if (filters.requireModeExclusive && !isModeExclusive(mode, card)) {
      return false;
    }

    if (filters.requireSharedAcrossAllModes && !isSharedAcrossAllModes(card)) {
      return false;
    }

    if (filters.educationalTagsAny && filters.educationalTagsAny.length > 0) {
      if (!filters.educationalTagsAny.includes(card.educationalTag)) {
        return false;
      }
    }

    return true;
  }

  private scoreDeckPreference(
    card: CardDefinition,
    mode: ModeCode,
    doctrine: ModeDoctrine,
    preferences?: DeckComposerPreferences,
  ): number {
    let score = doctrine.deckBias[card.deckType] ?? 0;

    // Wire `mode` — apply mode-native card score as a preference signal.
    // scoreCardForMode returns a 0–100 score capturing mode affinity,
    // so we blend it in at a low weight to nudge mode-native cards up
    // without overriding doctrine biases.
    score += scoreCardForMode(card, mode) * 0.08;

    if (preferences?.preferSabotage && card.tags.includes('sabotage')) {
      score += doctrine.sabotageBias;
    }

    if (preferences?.preferCounterplay && card.tags.includes('counter')) {
      score += doctrine.counterBias;
    }

    if (preferences?.preferAid && card.tags.includes('aid')) {
      score += doctrine.aidBias;
    }

    if (preferences?.preferTrust && card.tags.includes('trust')) {
      score += doctrine.trustBias;
    }

    if (preferences?.preferEconomy && includesAnyTags(card, ECONOMY_TAGS)) {
      score += doctrine.economyBias;
    }

    if (preferences?.preferResilience && includesAnyTags(card, RESILIENCE_TAGS)) {
      score += doctrine.resilienceBias;
    }

    if (preferences?.preferCascadeControl && card.tags.includes('cascade')) {
      score += doctrine.cascadeBias;
    }

    if (preferences?.preferTempo && card.tags.includes('tempo')) {
      score += doctrine.timingBias.POST ?? 0;
    }

    if (preferences?.preferMomentum && card.tags.includes('momentum')) {
      score += doctrine.economyBias / 2;
    }

    if (preferences?.preferScale && card.tags.includes('scale')) {
      score += doctrine.economyBias / 2;
    }

    return round4(score);
  }

  private scoreTags(
    card: CardDefinition,
    mode: ModeCode,
    doctrine: ModeDoctrine,
    preferences: DeckComposerPreferences | undefined,
    overlay: ModeOverlay,
  ): number {
    let score = 0;

    for (const tag of card.tags) {
      const baseWeight = MODE_TAG_WEIGHTS[mode][tag] ?? 1;
      const overlayWeight = overlay.tagWeights[tag] ?? 0;
      score += baseWeight * 2.25;
      score += overlayWeight * 2.0;
    }

    if (preferences?.preferEconomy && includesAnyTags(card, ECONOMY_TAGS)) {
      score += doctrine.economyBias;
    }

    if (preferences?.preferResilience && includesAnyTags(card, RESILIENCE_TAGS)) {
      score += doctrine.resilienceBias;
    }

    if (preferences?.preferSabotage && includesAnyTags(card, PREDATOR_TAGS)) {
      score += doctrine.sabotageBias / 2;
    }

    if (preferences?.preferTrust && includesAnyTags(card, SYNDICATE_TAGS)) {
      score += doctrine.trustBias / 2;
    }

    if (preferences?.preferPrecision && includesAnyTags(card, PHANTOM_TAGS)) {
      score += doctrine.precisionBias / 2;
    }

    return round4(score);
  }

  private scoreOverlay(
    card: CardDefinition,
    mode: ModeCode,
    overlay: ModeOverlay,
    doctrine: ModeDoctrine,
  ): number {
    let score = 0;

    if (!overlay.legal) {
      score -= 100;
    }

    score += (overlay.effectModifier - 1) * 25;
    score -= (overlay.costModifier - 1) * 10;

    if (overlay.targetingOverride && overlay.targetingOverride !== card.targeting) {
      if (mode === 'pvp' && overlay.targetingOverride === 'OPPONENT') {
        score += 6;
      } else if (mode === 'coop' && (overlay.targetingOverride === 'TEAM' || overlay.targetingOverride === 'TEAMMATE')) {
        score += 6;
      } else if (mode === 'ghost' && overlay.targetingOverride === 'SELF') {
        score += 2;
      }
    }

    if ((overlay.timingLock?.length ?? 0) > 0) {
      score += overlay.timingLock.reduce((sum, timing) => sum + (doctrine.timingBias[timing] ?? 0), 0) / 2;
    }

    if (overlay.divergencePotential === 'HIGH') {
      score += mode === 'ghost' ? doctrine.divergenceBias : 2;
    } else if (overlay.divergencePotential === 'MEDIUM') {
      score += mode === 'ghost' ? doctrine.divergenceBias / 2 : 1;
    }

    return round4(score);
  }

  private scoreTiming(
    card: CardDefinition,
    mode: ModeCode,
    doctrine: ModeDoctrine,
    preferences?: DeckComposerPreferences,
  ): number {
    let score = 0;

    for (const timing of card.timingClass) {
      score += doctrine.timingBias[timing] ?? 0;

      if (preferences?.favorReactionWindows && isReactionTiming(timing)) {
        score += doctrine.reactionBias;
      }

      if (preferences?.favorPhaseBoundary && timing === 'PHZ') {
        score += doctrine.phaseBias;
      }

      if (preferences?.favorGhostBenchmark && timing === 'GBM') {
        score += doctrine.ghostBias;
      }

      if (preferences?.favorEndgame && timing === 'END') {
        score += doctrine.endBias;
      }
    }

    if (mode === 'solo' && preferences?.phase === 'FOUNDATION') {
      if (card.timingClass.includes('PRE')) {
        score += 4;
      }

      if (card.timingClass.includes('PHZ')) {
        score += 5;
      }
    }

    if (mode === 'solo' && preferences?.phase === 'SOVEREIGNTY') {
      if (card.timingClass.includes('END')) {
        score += 6;
      }

      if (card.timingClass.includes('POST')) {
        score += 2;
      }
    }

    if (mode === 'pvp' && card.timingClass.includes('CTR')) {
      score += 4;
    }

    if (mode === 'coop' && (card.timingClass.includes('RES') || card.timingClass.includes('AID'))) {
      score += 4;
    }

    if (mode === 'ghost' && card.timingClass.includes('GBM')) {
      score += 6;
    }

    return round4(score);
  }

  private scoreRarity(
    card: CardDefinition,
    mode: ModeCode,
    doctrine: ModeDoctrine,
  ): number {
    const base = rarityRank(card.rarity) * 3.5;

    if (card.rarity === 'LEGENDARY') {
      if (mode === 'ghost') {
        return round4(base + doctrine.divergenceBias / 2);
      }

      if (mode === 'pvp') {
        return round4(base + 2);
      }
    }

    return round4(base);
  }

  private scoreCost(
    card: CardDefinition,
    effectiveCost: number,
    doctrine: ModeDoctrine,
    preferences?: DeckComposerPreferences,
  ): number {
    let score = 0;

    const thousands = effectiveCost / 1_000;

    if (effectiveCost <= 0) {
      score += doctrine.costBias + 4;
    } else {
      score += doctrine.costBias / 2;
      score -= thousands * 0.85;
    }

    if (preferences?.preferLowCost) {
      score += clamp(12 - thousands, -6, 12);
    }

    if (preferences?.preferHighCost) {
      score += clamp(thousands * 0.8, -4, 8);
    }

    if (card.baseEffect.incomeDelta && card.baseEffect.incomeDelta > 0 && effectiveCost > 0) {
      score += clamp(card.baseEffect.incomeDelta / effectiveCost * 25, -6, 10);
    }

    return round4(score);
  }

  private scoreDecay(
    card: CardDefinition,
    doctrine: ModeDoctrine,
    preferences?: DeckComposerPreferences,
  ): number {
    if (card.decayTicks === null) {
      return round4((preferences?.preferPersistence ? doctrine.decayBias : 1.5));
    }

    let score = 0;
    score -= clamp((10 - card.decayTicks) * 0.85, -10, 8);

    if (preferences?.preferLowDecay) {
      score += clamp(card.decayTicks * 0.55, -4, 10);
    }

    if (preferences?.preferPersistence) {
      score -= clamp((12 - card.decayTicks) * 0.75, -6, 10);
    }

    return round4(score);
  }

  private scoreDivergence(
    card: CardDefinition,
    effectiveDivergence: DivergencePotential,
    doctrine: ModeDoctrine,
    preferences?: DeckComposerPreferences,
  ): number {
    let score = 0;

    if (effectiveDivergence === 'HIGH') {
      score += doctrine.divergenceBias;
    } else if (effectiveDivergence === 'MEDIUM') {
      score += doctrine.divergenceBias / 2;
    }

    if ((card.baseEffect.divergenceDelta ?? 0) > 0) {
      score += card.baseEffect.divergenceDelta * 100;
    }

    if (preferences?.preferDivergence) {
      if (card.tags.includes('divergence')) {
        score += doctrine.divergenceBias;
      }

      if (card.timingClass.includes('GBM')) {
        score += doctrine.ghostBias / 2;
      }
    }

    if (preferences?.preferPrecision && card.tags.includes('precision')) {
      score += doctrine.precisionBias / 2;
    }

    return round4(score);
  }

  private scoreUtility(
    card: CardDefinition,
    mode: ModeCode,
    doctrine: ModeDoctrine,
    preferences: DeckComposerPreferences | undefined,
    reactionCard: boolean,
    phaseBoundaryCard: boolean,
    ghostBenchmarkCard: boolean,
    endgameCard: boolean,
  ): number {
    let score = 0;

    if (reactionCard) {
      score += doctrine.reactionBias / 2;
    }

    if (phaseBoundaryCard) {
      score += doctrine.phaseBias / 2;
    }

    if (ghostBenchmarkCard) {
      score += doctrine.ghostBias / 2;
    }

    if (endgameCard) {
      score += doctrine.endBias / 2;
    }

    if (card.autoResolve) {
      score += 1.5;
    }

    if (card.counterability === 'HARD') {
      score += 2.5;
    } else if (card.counterability === 'SOFT') {
      score += 1.25;
    }

    if ((card.baseEffect.injectCards?.length ?? 0) > 0) {
      score += 1.5 + (card.baseEffect.injectCards?.length ?? 0) * 0.6;
    }

    if ((card.baseEffect.grantBadges?.length ?? 0) > 0) {
      score += 2 + (mode === 'ghost' ? 2 : 0);
    }

    if (preferences?.preferredCardIds && preferences.preferredCardIds.includes(card.id)) {
      score += 12;
    }

    return round4(score);
  }

  private scorePenalty(
    card: CardDefinition,
    doctrine: ModeDoctrine,
    preferences: DeckComposerPreferences | undefined,
    overlay: ModeOverlay,
  ): number {
    let penalty = 0;

    if (preferences?.preferLowHeat && card.tags.includes('heat')) {
      penalty += doctrine.heatBias < 0 ? Math.abs(doctrine.heatBias) + 4 : 4;
    }

    if (!preferences?.preferHighHeat && card.tags.includes('heat') && doctrine.mode === 'solo') {
      penalty += 1.5;
    }

    if (preferences?.preferLowCost && card.baseCost > 8_000) {
      penalty += clamp(card.baseCost / 2_000, 0, 8);
    }

    if (preferences?.preferPersistence && card.decayTicks !== null && card.decayTicks <= 4) {
      penalty += 4;
    }

    if (doctrine.mode === 'ghost' && card.tags.includes('variance') && !card.tags.includes('precision')) {
      penalty += 4.5;
    }

    if (doctrine.mode === 'coop' && card.tags.includes('sabotage')) {
      penalty += 20;
    }

    if (doctrine.mode === 'pvp' && card.tags.includes('trust')) {
      penalty += 10;
    }

    if ((overlay.timingLock?.length ?? 0) >= 3) {
      penalty += 1.5;
    }

    return round4(penalty);
  }

  private buildExplanation(
    card: CardDefinition,
    mode: ModeCode,
    doctrine: ModeDoctrine,
    preferences: DeckComposerPreferences | undefined,
    overlay: ModeOverlay,
    score: Omit<ModeCardScoreBreakdown, 'finalScore'> & { readonly finalScore: number },
    reactionCard: boolean,
    phaseBoundaryCard: boolean,
    ghostBenchmarkCard: boolean,
    endgameCard: boolean,
    modeExclusive: boolean,
    sharedAcrossAllModes: boolean,
  ): string[] {
    const explanation: string[] = [];

    explanation.push(
      `${card.id} scored ${score.finalScore.toFixed(4)} in ${mode} from base mode score ${score.baseModeScore.toFixed(4)}.`,
    );

    explanation.push(
      `Deck ${card.deckType} received doctrine bias ${(doctrine.deckBias[card.deckType] ?? 0).toFixed(4)} and deck priority contribution ${score.deckPriorityScore.toFixed(4)}.`,
    );

    if (card.tags.length > 0) {
      explanation.push(
        `Tags ${card.tags.join(', ')} produced tag score ${score.tagScore.toFixed(4)} against ${mode} tag weights.`,
      );
    }

    if (overlay.effectModifier !== 1 || overlay.costModifier !== 1 || (overlay.timingLock?.length ?? 0) > 0) {
      explanation.push(
        `Overlay adjusted cost x${overlay.costModifier.toFixed(3)}, effect x${overlay.effectModifier.toFixed(3)}, and overlay score ${score.overlayScore.toFixed(4)}.`,
      );
    }

    if (reactionCard) {
      explanation.push('Card is a reaction-window card and benefits from reactive composition logic.');
    }

    if (phaseBoundaryCard) {
      explanation.push('Card is phase-boundary aligned and treated as scarce Empire timing inventory.');
    }

    if (ghostBenchmarkCard) {
      explanation.push('Card is ghost-benchmark aligned and treated as divergence-window inventory.');
    }

    if (endgameCard) {
      explanation.push('Card is endgame-capable and receives closing-window credit.');
    }

    if (modeExclusive) {
      explanation.push('Card is mode-exclusive, increasing identity alignment for this mode.');
    } else if (sharedAcrossAllModes) {
      explanation.push('Card is shared across all modes, increasing interoperability but reducing exclusivity.');
    }

    if (preferences?.phase) {
      explanation.push(`Composition evaluated against phase preference ${preferences.phase}.`);
    }

    if (preferences?.preferPrecision && card.tags.includes('precision')) {
      explanation.push('Precision preference amplified this card.');
    }

    if (preferences?.preferDivergence && (card.tags.includes('divergence') || card.timingClass.includes('GBM'))) {
      explanation.push('Divergence preference amplified this card.');
    }

    if (preferences?.preferTrust && card.tags.includes('trust')) {
      explanation.push('Trust preference amplified this card.');
    }

    if (preferences?.preferSabotage && card.tags.includes('sabotage')) {
      explanation.push('Pressure preference amplified sabotage capacity.');
    }

    if (score.penaltyScore > 0) {
      explanation.push(`Penalty score ${score.penaltyScore.toFixed(4)} reduced rank due to doctrine conflicts or preference mismatches.`);
    }

    return explanation;
  }

  private deriveBucketLabel(card: CardDefinition, mode: ModeCode): string {
    if (card.timingClass.includes('GBM') && mode === 'ghost') {
      return 'GHOST_WINDOW';
    }

    if (card.timingClass.includes('PHZ') && mode === 'solo') {
      return 'PHASE_BOUNDARY';
    }

    if (card.timingClass.includes('CTR') && mode === 'pvp') {
      return 'COUNTER_WINDOW';
    }

    if ((card.timingClass.includes('RES') || card.timingClass.includes('AID')) && mode === 'coop') {
      return 'TEAM_REACTION';
    }

    if (card.tags.includes('precision')) {
      return 'PRECISION';
    }

    if (card.tags.includes('sabotage')) {
      return 'PRESSURE';
    }

    if (card.tags.includes('trust') || card.tags.includes('aid')) {
      return 'TRUST';
    }

    if (includesAnyTags(card, ECONOMY_TAGS)) {
      return 'ECONOMY';
    }

    return card.deckType;
  }

  private allocateDeckTargets(
    quotas: Readonly<Record<DeckType, number>>,
    size: number,
    requiredDecks: readonly DeckType[],
  ): Record<DeckType, number> {
    const targets = createEmptyCountBuckets();
    let allocated = 0;

    for (const deckType of ALL_DECK_TYPES) {
      const raw = quotas[deckType] ?? 0;
      if (raw <= 0) {
        continue;
      }

      const target = Math.floor(raw * size);
      targets[deckType] = target;
      allocated += target;
    }

    for (const deckType of requiredDecks) {
      if (targets[deckType] <= 0) {
        targets[deckType] = 1;
        allocated += 1;
      }
    }

    while (allocated < size) {
      const nextDeck = this.nextDeckForAllocation(quotas, targets);
      targets[nextDeck] += 1;
      allocated += 1;
    }

    while (allocated > size) {
      const nextDeck = this.nextDeckForReduction(quotas, targets, requiredDecks);
      if (!nextDeck) {
        break;
      }

      targets[nextDeck] -= 1;
      allocated -= 1;
    }

    return targets;
  }

  private nextDeckForAllocation(
    quotas: Readonly<Record<DeckType, number>>,
    current: Readonly<Record<DeckType, number>>,
  ): DeckType {
    let bestDeck: DeckType = 'OPPORTUNITY';
    let bestGap = Number.NEGATIVE_INFINITY;

    for (const deckType of ALL_DECK_TYPES) {
      const quota = quotas[deckType] ?? 0;
      const gap = quota - current[deckType] * 0.001;
      if (gap > bestGap) {
        bestGap = gap;
        bestDeck = deckType;
      }
    }

    return bestDeck;
  }

  private nextDeckForReduction(
    quotas: Readonly<Record<DeckType, number>>,
    current: Readonly<Record<DeckType, number>>,
    requiredDecks: readonly DeckType[],
  ): DeckType | null {
    let bestDeck: DeckType | null = null;
    let bestExcess = Number.NEGATIVE_INFINITY;

    for (const deckType of ALL_DECK_TYPES) {
      if (current[deckType] <= 0) {
        continue;
      }

      if (requiredDecks.includes(deckType) && current[deckType] <= 1) {
        continue;
      }

      const excess = current[deckType] - (quotas[deckType] ?? 0);
      if (excess > bestExcess) {
        bestExcess = excess;
        bestDeck = deckType;
      }
    }

    return bestDeck;
  }

  private compareEvaluations(
    left: DeckComposerCardEvaluation,
    right: DeckComposerCardEvaluation,
    mode: ModeCode,
  ): number {
    if (left.score.finalScore !== right.score.finalScore) {
      return right.score.finalScore - left.score.finalScore;
    }

    const byDeckPriority = getModeDeckPriority(mode, left.definition.deckType)
      - getModeDeckPriority(mode, right.definition.deckType);
    if (byDeckPriority !== 0) {
      return byDeckPriority;
    }

    if (left.tagWeightTotal !== right.tagWeightTotal) {
      return right.tagWeightTotal - left.tagWeightTotal;
    }

    if (left.definition.rarity !== right.definition.rarity) {
      return rarityRank(right.definition.rarity) - rarityRank(left.definition.rarity);
    }

    if (left.effectiveCost !== right.effectiveCost) {
      return left.effectiveCost - right.effectiveCost;
    }

    if (left.definition.decayTicks !== right.definition.decayTicks) {
      if (left.definition.decayTicks === null) {
        return -1;
      }

      if (right.definition.decayTicks === null) {
        return 1;
      }

      return right.definition.decayTicks - left.definition.decayTicks;
    }

    return compareString(left.definition.id, right.definition.id);
  }

  /* ──────────────────────────────────────────────────────────────────────────
   * Mode-exclusive deck queries — wires `MODE_EXCLUSIVE_DECKS`
   * ────────────────────────────────────────────────────────────────────────── */

  /**
   * Returns the deck types that are exclusive to a given mode.
   * These are decks whose targeting and doctrine is only meaningful in that mode.
   *
   * Wires `MODE_EXCLUSIVE_DECKS`.
   *
   * Consumed by:
   * - Deck composition filters ("only include mode-appropriate deck types")
   * - Chat narrator ("In Predator mode, SABOTAGE and BLUFF decks are unlocked.")
   * - UX mode onboarding ("these cards are special to your mode")
   */
  public listModeExclusiveDecks(mode: ModeCode): readonly DeckType[] {
    return MODE_EXCLUSIVE_DECKS[mode];
  }

  /**
   * Returns whether a given deck type is exclusive to a specific mode.
   * Wires `MODE_EXCLUSIVE_DECKS`.
   */
  public isDeckTypeExclusiveToMode(deckType: DeckType, mode: ModeCode): boolean {
    return MODE_EXCLUSIVE_DECKS[mode].includes(deckType as never);
  }

  /**
   * Returns all cards from the registry whose deck type is exclusive to the
   * given mode. These are the "signature" cards for that mode's doctrine.
   * Wires `MODE_EXCLUSIVE_DECKS`.
   */
  public getModeSignatureCards(mode: ModeCode): readonly CardDefinition[] {
    const exclusiveDecks = MODE_EXCLUSIVE_DECKS[mode];
    const all = this.registry.all();
    return Object.freeze(
      all.filter(
        (card) =>
          (exclusiveDecks as readonly string[]).includes(card.deckType) &&
          this.isModeLegal(card, mode),
      ),
    );
  }

  /* ──────────────────────────────────────────────────────────────────────────
   * Archetype ordering — wires `ARCHETYPE_PRIORITY_ORDER`
   * ────────────────────────────────────────────────────────────────────────── */

  /**
   * Returns the canonical archetype priority order.
   * This is the order in which archetypes are considered when building a deck.
   *
   * Wires `ARCHETYPE_PRIORITY_ORDER`.
   *
   * Consumed by:
   * - AI planner ("what archetype should I prioritize for this mode?")
   * - Deck composer default selection ("fall back to GENERAL if nothing else fits")
   * - UX mode select screen ("show archetypes in priority order")
   */
  public getArchetypePriorityOrder(): readonly DeckComposerArchetype[] {
    return ARCHETYPE_PRIORITY_ORDER;
  }

  /**
   * Returns the priority rank of a given archetype (lower = higher priority).
   * Wires `ARCHETYPE_PRIORITY_ORDER`.
   */
  public getArchetypePriorityRank(archetype: DeckComposerArchetype): number {
    const idx = ARCHETYPE_PRIORITY_ORDER.indexOf(archetype);
    return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
  }

  /**
   * Sorts a list of archetypes by their priority rank.
   * Wires `ARCHETYPE_PRIORITY_ORDER`.
   */
  public sortArchetypesByPriority(
    archetypes: readonly DeckComposerArchetype[],
  ): readonly DeckComposerArchetype[] {
    return Object.freeze(
      [...archetypes].sort(
        (a, b) =>
          this.getArchetypePriorityRank(a) - this.getArchetypePriorityRank(b),
      ),
    );
  }

  /* ──────────────────────────────────────────────────────────────────────────
   * Deck-type sort — wires `compareDeckType`
   * ────────────────────────────────────────────────────────────────────────── */

  /**
   * Sorts card definitions by deck type in canonical `ALL_DECK_TYPES` order.
   *
   * Wires `compareDeckType`.
   *
   * Consumed by:
   * - Deck catalog display (consistent deck-type grouping)
   * - Proof chain artifact serialization (deterministic order)
   * - Audit exports (group by deck type in a canonical way)
   */
  public sortCardsByDeckType(
    cards: readonly CardDefinition[],
  ): readonly CardDefinition[] {
    return Object.freeze(
      [...cards].sort((a, b) => compareDeckType(a.deckType, b.deckType)),
    );
  }

  /**
   * Groups card definitions by deck type and sorts each bucket internally by
   * deck type order and then by definition ID.
   * Wires `compareDeckType`.
   */
  public groupAndSortByDeckType(
    cards: readonly CardDefinition[],
  ): Readonly<Record<DeckType, readonly CardDefinition[]>> {
    const buckets: Record<string, CardDefinition[]> = {};

    for (const card of cards) {
      if (!buckets[card.deckType]) {
        buckets[card.deckType] = [];
      }
      buckets[card.deckType].push(card);
    }

    // Sort each bucket by definition ID for determinism
    for (const dt of Object.keys(buckets)) {
      buckets[dt].sort((a, b) => a.id.localeCompare(b.id));
    }

    // Build sorted output ordered by ALL_DECK_TYPES canonical order
    const sorted: Partial<Record<DeckType, readonly CardDefinition[]>> = {};
    const sortedKeys = Object.keys(buckets).sort((a, b) =>
      compareDeckType(a as DeckType, b as DeckType),
    );
    for (const key of sortedKeys) {
      sorted[key as DeckType] = Object.freeze(buckets[key]);
    }

    return Object.freeze(sorted) as Readonly<Record<DeckType, readonly CardDefinition[]>>;
  }

  /* ──────────────────────────────────────────────────────────────────────────
   * Effect magnitude scoring — wires `buildEffectMagnitude`
   * ────────────────────────────────────────────────────────────────────────── */

  /**
   * Scores the effect magnitude for a single card given a mode overlay.
   *
   * Wires `buildEffectMagnitude`.
   *
   * Consumed by:
   * - AI planner: rank cards by raw effect power before mode-specific scoring
   * - Deck composition "budget" planning: how much power does this deck have?
   * - Chat narrator: "This card has a high effect magnitude for this mode."
   * - UX card detail tooltip: numerical power display
   */
  public scoreCardEffectMagnitude(card: CardDefinition, mode: ModeCode): number {
    const overlay = resolveModeOverlay(card, mode);
    return buildEffectMagnitude(card, overlay);
  }

  /**
   * Builds an effect magnitude profile for a set of cards in a given mode,
   * returning per-card magnitudes plus aggregate statistics.
   *
   * Wires `buildEffectMagnitude`.
   *
   * Consumed by:
   * - Deck health report ("your deck's average power level")
   * - AI planner hand power assessment
   * - Composition review: outlier detection (very high or very low magnitude cards)
   */
  public buildEffectMagnitudeProfile(
    cards: readonly CardDefinition[],
    mode: ModeCode,
  ): EffectMagnitudeProfile {
    if (cards.length === 0) {
      return Object.freeze({
        cards: Object.freeze([]),
        mode,
        magnitudes: Object.freeze([]),
        total: 0,
        average: 0,
        max: 0,
        min: 0,
        topThreeIds: Object.freeze([]),
        bottomThreeIds: Object.freeze([]),
      });
    }

    const entries: Array<{ id: string; magnitude: number }> = cards.map((card) => ({
      id: card.id,
      magnitude: buildEffectMagnitude(card, resolveModeOverlay(card, mode)),
    }));

    const magnitudes = entries.map((e) => e.magnitude);
    const total = round4(magnitudes.reduce((s, m) => s + m, 0));
    const average = round4(total / magnitudes.length);
    const max = Math.max(...magnitudes);
    const min = Math.min(...magnitudes);

    const sorted = [...entries].sort((a, b) => b.magnitude - a.magnitude);
    const topThreeIds = Object.freeze(sorted.slice(0, 3).map((e) => e.id));
    const bottomThreeIds = Object.freeze(
      sorted.slice(-3).map((e) => e.id).reverse(),
    );

    return Object.freeze({
      cards: Object.freeze(cards),
      mode,
      magnitudes: Object.freeze(magnitudes),
      total,
      average,
      max,
      min,
      topThreeIds,
      bottomThreeIds,
    });
  }

  /**
   * Returns the top N cards by effect magnitude for a given mode.
   * Wires `buildEffectMagnitude` and `compareDeckType`.
   *
   * Useful for "power pick" suggestions and AI planning.
   */
  public topCardsByMagnitude(
    mode: ModeCode,
    n: number,
    deckTypeFilter?: readonly DeckType[],
  ): readonly CardDefinition[] {
    let candidates = this.registry.all().filter(
      (card) => this.isModeLegal(card, mode),
    );

    if (deckTypeFilter && deckTypeFilter.length > 0) {
      candidates = candidates.filter((c) => deckTypeFilter.includes(c.deckType));
    }

    return Object.freeze(
      candidates
        .map((card) => ({
          card,
          magnitude: buildEffectMagnitude(card, resolveModeOverlay(card, mode)),
        }))
        .sort((a, b) => {
          if (b.magnitude !== a.magnitude) {
            return b.magnitude - a.magnitude;
          }
          // Tie-break by deck type canonical order
          return compareDeckType(a.card.deckType, b.card.deckType);
        })
        .slice(0, n)
        .map((e) => e.card),
    );
  }

  private isModeLegal(card: CardDefinition, mode: ModeCode): boolean {
    if (!card.modeLegal.includes(mode)) {
      return false;
    }

    return resolveModeOverlay(card, mode).legal;
  }
}
