
/*
 * POINT ZERO ONE — BACKEND CASCADE RECOVERY CHECKER
 * /backend/src/game/engine/cascade/RecoveryConditionChecker.ts
 *
 * Doctrine:
 * - recovery must be explainable from current authoritative run state
 * - structured recovery conditions take precedence over loose tag checks
 * - legacy tag compatibility is preserved because chain instances currently
 *   only persist recoveryTags, not full template recovery state
 * - additive expansion is preferred over breaking renames
 * - backend remains the authority for recovery truth, not UI heuristics
 *
 * Design notes:
 * - this file preserves the existing public entry point:
 *     isRecovered(chain, snapshot, template): boolean
 * - richer evaluation/reporting helpers are additive
 * - recovery never succeeds for positive chains
 * - structured conditions are evaluated against the v2 backend snapshot shape
 * - legacy recovery remains intentionally narrow enough to avoid accidental
 *   unlocks, but broad enough to preserve existing tag-era authored content
 */

import type {
  CardInstance,
  CascadeChainInstance,
  PressureTier,
} from '../core/GamePrimitives';
import type {
  ModeState,
  RunStateSnapshot,
  ShieldLayerState,
} from '../core/RunStateSnapshot';
import {
  EMPTY_RECOVERY_EVALUATIONS,
  RECOVERY_CONDITION_COMPARATOR_BY_KIND,
  RECOVERY_CONDITION_STATUSES,
} from './types';
import type {
  CascadeTemplate,
  RecoveryCondition,
  RecoveryConditionComparator,
  RecoveryConditionKind,
  RecoveryConditionStatus as CanonicalRecoveryStatus,
} from './types';

/**
 * Internal source families used for explainability and safe diagnostics.
 */
export type RecoveryEvidenceSource =
  | 'STRUCTURED'
  | 'LEGACY_TAG'
  | 'CARD_HAND'
  | 'LAST_PLAYED'
  | 'DISCARD'
  | 'EXHAUST'
  | 'DRAW_HISTORY'
  | 'GHOST_MARKER'
  | 'MODE_STATE'
  | 'ECONOMY'
  | 'PRESSURE'
  | 'SHIELD'
  | 'CASCADE';

/**
 * Fine-grained condition status.
 */
export type RecoveryConditionStatus =
  | 'PASSED'
  | 'FAILED'
  | 'SKIPPED'
  | 'NOT_APPLICABLE';

/**
 * Legacy matching policy — kept internal so the engine can evolve without
 * changing the public recovery interface.
 */
type LegacyBagSection =
  | 'HAND_TAG'
  | 'HAND_CARD_NAME'
  | 'HAND_DEFINITION_ID'
  | 'HAND_DECK_TYPE'
  | 'HAND_EDUCATIONAL_TAG'
  | 'HAND_TIMING_CLASS'
  | 'HAND_TARGETING'
  | 'LAST_PLAYED'
  | 'DISCARD'
  | 'EXHAUST'
  | 'DRAW_HISTORY'
  | 'GHOST_MARKER_KIND'
  | 'GHOST_MARKER_CARD_ID'
  | 'ROLE_ASSIGNMENT'
  | 'HANDICAP_ID'
  | 'ADVANTAGE_ID'
  | 'SPECIAL_MODE_FLAG';

/**
 * Structured evaluation record for a single authored recovery condition.
 */
export interface RecoveryConditionEvaluation {
  readonly condition: RecoveryCondition;
  readonly status: RecoveryConditionStatus;
  readonly actualValue:
    | number
    | string
    | boolean
    | readonly string[]
    | null;
  readonly expectedValue:
    | number
    | string
    | boolean
    | readonly string[]
    | null;
  readonly explanation: string;
  readonly sources: readonly RecoveryEvidenceSource[];
}

/**
 * Legacy tag hit projection for authored tags that still rely on the older
 * recoveryTags compatibility surface.
 */
export interface LegacyRecoveryHit {
  readonly tag: string;
  readonly normalizedTag: string;
  readonly matched: boolean;
  readonly matchedValue: string | null;
  readonly matchedSection: LegacyBagSection | null;
  readonly explanation: string;
}

/**
 * Full report object for callers that want more than a boolean.
 * This is additive and does not change the existing CascadeEngine contract.
 */
export interface RecoveryEvaluationReport {
  readonly recovered: boolean;
  readonly positiveChain: boolean;
  readonly usedStructuredRecovery: boolean;
  readonly usedLegacyRecovery: boolean;
  readonly structuredSatisfied: boolean;
  readonly legacySatisfied: boolean;
  readonly structuredEvaluations: readonly RecoveryConditionEvaluation[];
  readonly legacyHits: readonly LegacyRecoveryHit[];
  readonly normalizedRecoveryTags: readonly string[];
  readonly summary: string;
}

/**
 * Normalized token record used by legacy compatibility matching.
 */
interface LegacyTokenEntry {
  readonly value: string;
  readonly section: LegacyBagSection;
}

/**
 * A narrowed, lookup-friendly descriptor of a runtime card instance.
 */
interface NormalizedCardDescriptor {
  readonly instanceId: string;
  readonly definitionId: string;
  readonly name: string;
  readonly deckType: string;
  readonly educationalTag: string;
  readonly targeting: string;
  readonly timingClasses: readonly string[];
  readonly tags: readonly string[];
  readonly allSearchTokens: readonly string[];
}

/**
 * Stable ordering for pressure tiers.
 */
const PRESSURE_TIER_ORDER: Readonly<Record<PressureTier, number>> = Object.freeze({
  T0: 0,
  T1: 1,
  T2: 2,
  T3: 3,
  T4: 4,
});

/**
 * Tokens that identify special mode-state switches. These stay additive and
 * deterministic so authored recovery tags can safely target them when needed.
 */
const SPECIAL_MODE_FLAGS = Object.freeze({
  HOLD_ENABLED: 'mode:hold_enabled',
  LOADOUT_ENABLED: 'mode:loadout_enabled',
  SHARED_TREASURY: 'mode:shared_treasury',
  LEGEND_MARKERS_ENABLED: 'mode:legend_markers_enabled',
  SHARED_OPPORTUNITY_DECK: 'mode:shared_opportunity_deck',
  ROLE_LOCK_ENABLED: 'mode:role_lock_enabled',
  BLEED_MODE: 'mode:bleed_mode',
});

/**
 * Default explanation text constants. Centralizing these keeps the authored
 * summary output stable across future refactors.
 */
const EXPLANATIONS = Object.freeze({
  POSITIVE_CHAIN_NEVER_RECOVERS:
    'Positive cascade chains do not use recovery interruption.',
  STRUCTURED_ALL_PASSED:
    'All structured recovery conditions passed.',
  STRUCTURED_FAILED:
    'One or more structured recovery conditions failed.',
  STRUCTURED_NOT_AUTHORED:
    'No structured recovery conditions were authored for this template.',
  LEGACY_MATCHED:
    'Legacy recovery tags matched against the authoritative runtime bag.',
  LEGACY_NOT_MATCHED:
    'Legacy recovery tags did not match the authoritative runtime bag.',
  LEGACY_NOT_AUTHORED:
    'No legacy recovery tags were authored for this chain/template.',
});

/**
 * RecoveryConditionChecker
 *
 * The existing public contract remains intentionally simple:
 *   isRecovered(...) => boolean
 *
 * Everything else in this class is built to:
 * - preserve deterministic behavior
 * - improve explainability
 * - widen authored compatibility carefully rather than loosely
 * - keep recovery semantics backend-owned
 */
export class RecoveryConditionChecker {
  /**
   * The canonical boolean used by CascadeEngine.
   */
  public isRecovered(
    chain: CascadeChainInstance,
    snapshot: RunStateSnapshot,
    template: CascadeTemplate,
  ): boolean {
    return this.evaluate(chain, snapshot, template).recovered;
  }

  /**
   * Rich additive evaluation surface. Useful for diagnostics, tests, replay
   * tooling, operator dashboards, and future chat/proof narration.
   */
  public evaluate(
    chain: CascadeChainInstance,
    snapshot: RunStateSnapshot,
    template: CascadeTemplate,
  ): RecoveryEvaluationReport {
    if (chain.positive) {
      return {
        recovered: false,
        positiveChain: true,
        usedStructuredRecovery: false,
        usedLegacyRecovery: false,
        structuredSatisfied: false,
        legacySatisfied: false,
        structuredEvaluations: [],
        legacyHits: [],
        normalizedRecoveryTags: [],
        summary: EXPLANATIONS.POSITIVE_CHAIN_NEVER_RECOVERS,
      };
    }

    const structuredEvaluations = this.evaluateStructuredConditions(
      template.recovery,
      snapshot,
    );
    const structuredSatisfied =
      template.recovery.length > 0 &&
      structuredEvaluations.length > 0 &&
      structuredEvaluations.every((evaluation) => evaluation.status === 'PASSED');

    const normalizedRecoveryTags = this.normalizeList(
      this.collectRecoveryTagsForEvaluation(chain, template),
    );

    const legacyHits = this.evaluateLegacyRecovery(
      normalizedRecoveryTags,
      snapshot,
    );
    const legacySatisfied =
      normalizedRecoveryTags.length > 0 &&
      legacyHits.some((hit) => hit.matched);

    const recovered = structuredSatisfied || legacySatisfied;

    return {
      recovered,
      positiveChain: false,
      usedStructuredRecovery: template.recovery.length > 0,
      usedLegacyRecovery: normalizedRecoveryTags.length > 0,
      structuredSatisfied,
      legacySatisfied,
      structuredEvaluations,
      legacyHits,
      normalizedRecoveryTags,
      summary: this.buildSummary(
        template,
        structuredEvaluations,
        structuredSatisfied,
        normalizedRecoveryTags,
        legacyHits,
        legacySatisfied,
      ),
    };
  }

  /**
   * Additive helper for logs/tests/UI tooling.
   */
  public describeRecovery(
    chain: CascadeChainInstance,
    snapshot: RunStateSnapshot,
    template: CascadeTemplate,
  ): string {
    return this.evaluate(chain, snapshot, template).summary;
  }

  /**
   * Authoritative structured recovery evaluation.
   *
   * Important:
   * - we do not short-circuit at the first failure because explainability matters
   * - the recovery boolean still requires all authored structured conditions to pass
   */
  private evaluateStructuredConditions(
    conditions: readonly RecoveryCondition[],
    snapshot: RunStateSnapshot,
  ): RecoveryConditionEvaluation[] {
    if (conditions.length === 0) {
      return [];
    }

    return conditions.map((condition) =>
      this.evaluateCondition(condition, snapshot),
    );
  }

  /**
   * Evaluates a single authored recovery condition against the v2 snapshot.
   */
  private evaluateCondition(
    condition: RecoveryCondition,
    snapshot: RunStateSnapshot,
  ): RecoveryConditionEvaluation {
    switch (condition.kind) {
      case 'CARD_TAG_ANY':
        return this.evaluateCardTagAny(condition.tags, snapshot.cards.hand);

      case 'LAST_PLAYED_TAG_ANY':
        return this.evaluateLastPlayedTagAny(condition.tags, snapshot.cards.lastPlayed);

      case 'CASH_MIN':
        return this.evaluateCashMin(condition.amount, snapshot);

      case 'WEAKEST_SHIELD_RATIO_MIN':
        return this.evaluateWeakestShieldRatioMin(condition.ratio, snapshot);

      case 'ALL_SHIELDS_RATIO_MIN':
        return this.evaluateAllShieldsRatioMin(condition.ratio, snapshot);

      case 'TRUST_ANY_MIN':
        return this.evaluateTrustAnyMin(condition.score, snapshot);

      case 'HEAT_MAX':
        return this.evaluateHeatMax(condition.amount, snapshot);

      case 'PRESSURE_NOT_ABOVE':
        return this.evaluatePressureNotAbove(condition.tier, snapshot);

      default: {
        const exhaustive: never = condition;
        return {
          condition: exhaustive,
          status: 'FAILED',
          actualValue: null,
          expectedValue: null,
          explanation: 'Unknown recovery condition kind encountered.',
          sources: ['STRUCTURED'],
        };
      }
    }
  }

  /**
   * Structured condition: CARD_TAG_ANY
   *
   * This is intentionally broader than raw card.tags-only matching while still
   * remaining card-authored:
   * - runtime card instance tags
   * - definition tags
   * - deck type
   * - educational tag
   * - timing classes
   * - targeting
   *
   * That breadth keeps authored recovery robust even when decks evolve.
   */
  private evaluateCardTagAny(
    tags: readonly string[],
    hand: readonly CardInstance[],
  ): RecoveryConditionEvaluation {
    const expected = this.normalizeList(tags);
    const descriptors = hand.map((card) => this.describeCard(card));

    const bag = new Set<string>();
    for (const descriptor of descriptors) {
      for (const token of descriptor.allSearchTokens) {
        bag.add(token);
      }
    }

    const matched = expected.filter((tag) => bag.has(tag));
    const passed = matched.length > 0;

    return {
      condition: {
        kind: 'CARD_TAG_ANY',
        tags,
      },
      status: passed ? 'PASSED' : 'FAILED',
      actualValue: matched,
      expectedValue: expected,
      explanation: passed
        ? `Hand matched recovery tags: ${matched.join(', ')}.`
        : `No hand card token matched authored recovery tags: ${expected.join(', ')}.`,
      sources: ['STRUCTURED', 'CARD_HAND'],
    };
  }

  /**
   * Structured condition: LAST_PLAYED_TAG_ANY
   *
   * The lastPlayed array is already a flattened compatibility surface in the
   * current snapshot, so we treat it as authoritative string evidence.
   */
  private evaluateLastPlayedTagAny(
    tags: readonly string[],
    lastPlayed: readonly string[],
  ): RecoveryConditionEvaluation {
    const expected = this.normalizeList(tags);
    const actualSet = new Set(this.normalizeList(lastPlayed));
    const matched = expected.filter((tag) => actualSet.has(tag));
    const passed = matched.length > 0;

    return {
      condition: {
        kind: 'LAST_PLAYED_TAG_ANY',
        tags,
      },
      status: passed ? 'PASSED' : 'FAILED',
      actualValue: matched,
      expectedValue: expected,
      explanation: passed
        ? `Last played history matched recovery tags: ${matched.join(', ')}.`
        : `Last played history did not match authored tags: ${expected.join(', ')}.`,
      sources: ['STRUCTURED', 'LAST_PLAYED'],
    };
  }

  /**
   * Structured condition: CASH_MIN
   */
  private evaluateCashMin(
    amount: number,
    snapshot: RunStateSnapshot,
  ): RecoveryConditionEvaluation {
    const actual = snapshot.economy.cash;
    const passed = actual >= amount;

    return {
      condition: {
        kind: 'CASH_MIN',
        amount,
      },
      status: passed ? 'PASSED' : 'FAILED',
      actualValue: actual,
      expectedValue: amount,
      explanation: passed
        ? `Cash threshold satisfied (${actual} >= ${amount}).`
        : `Cash threshold not satisfied (${actual} < ${amount}).`,
      sources: ['STRUCTURED', 'ECONOMY'],
    };
  }

  /**
   * Structured condition: WEAKEST_SHIELD_RATIO_MIN
   */
  private evaluateWeakestShieldRatioMin(
    ratio: number,
    snapshot: RunStateSnapshot,
  ): RecoveryConditionEvaluation {
    const actual = snapshot.shield.weakestLayerRatio;
    const passed = actual >= ratio;

    return {
      condition: {
        kind: 'WEAKEST_SHIELD_RATIO_MIN',
        ratio,
      },
      status: passed ? 'PASSED' : 'FAILED',
      actualValue: actual,
      expectedValue: ratio,
      explanation: passed
        ? `Weakest shield ratio satisfied (${this.formatRatio(actual)} >= ${this.formatRatio(ratio)}).`
        : `Weakest shield ratio not satisfied (${this.formatRatio(actual)} < ${this.formatRatio(ratio)}).`,
      sources: ['STRUCTURED', 'SHIELD'],
    };
  }

  /**
   * Structured condition: ALL_SHIELDS_RATIO_MIN
   */
  private evaluateAllShieldsRatioMin(
    ratio: number,
    snapshot: RunStateSnapshot,
  ): RecoveryConditionEvaluation {
    const failingLayers = snapshot.shield.layers
      .filter((layer) => layer.integrityRatio < ratio)
      .map((layer) => `${layer.layerId}:${this.formatRatio(layer.integrityRatio)}`);

    const passed = failingLayers.length === 0;

    return {
      condition: {
        kind: 'ALL_SHIELDS_RATIO_MIN',
        ratio,
      },
      status: passed ? 'PASSED' : 'FAILED',
      actualValue: passed ? snapshot.shield.layers.map((layer) => `${layer.layerId}:${this.formatRatio(layer.integrityRatio)}`) : failingLayers,
      expectedValue: ratio,
      explanation: passed
        ? `All shield layers met minimum ratio ${this.formatRatio(ratio)}.`
        : `Shield layers below minimum ratio ${this.formatRatio(ratio)}: ${failingLayers.join(', ')}.`,
      sources: ['STRUCTURED', 'SHIELD'],
    };
  }

  /**
   * Structured condition: TRUST_ANY_MIN
   */
  private evaluateTrustAnyMin(
    score: number,
    snapshot: RunStateSnapshot,
  ): RecoveryConditionEvaluation {
    const entries = Object.entries(snapshot.modeState.trustScores);
    const satisfiedEntries = entries
      .filter(([, value]) => value >= score)
      .map(([playerId, value]) => `${playerId}:${value}`);

    const maxSeen = entries.length === 0 ? null : Math.max(...entries.map(([, value]) => value));
    const passed = satisfiedEntries.length > 0;

    return {
      condition: {
        kind: 'TRUST_ANY_MIN',
        score,
      },
      status: passed ? 'PASSED' : 'FAILED',
      actualValue: passed ? satisfiedEntries : maxSeen,
      expectedValue: score,
      explanation: passed
        ? `Trust threshold satisfied by ${satisfiedEntries.join(', ')}.`
        : entries.length === 0
          ? `No trust scores were present; threshold ${score} could not be satisfied.`
          : `No trust score met threshold ${score}; highest observed was ${maxSeen}.`,
      sources: ['STRUCTURED', 'MODE_STATE'],
    };
  }

  /**
   * Structured condition: HEAT_MAX
   */
  private evaluateHeatMax(
    amount: number,
    snapshot: RunStateSnapshot,
  ): RecoveryConditionEvaluation {
    const actual = snapshot.economy.haterHeat;
    const passed = actual <= amount;

    return {
      condition: {
        kind: 'HEAT_MAX',
        amount,
      },
      status: passed ? 'PASSED' : 'FAILED',
      actualValue: actual,
      expectedValue: amount,
      explanation: passed
        ? `Hater heat cap satisfied (${actual} <= ${amount}).`
        : `Hater heat cap not satisfied (${actual} > ${amount}).`,
      sources: ['STRUCTURED', 'ECONOMY'],
    };
  }

  /**
   * Structured condition: PRESSURE_NOT_ABOVE
   */
  private evaluatePressureNotAbove(
    tier: PressureTier,
    snapshot: RunStateSnapshot,
  ): RecoveryConditionEvaluation {
    const actual = snapshot.pressure.tier;
    const passed = this.tierRank(actual) <= this.tierRank(tier);

    return {
      condition: {
        kind: 'PRESSURE_NOT_ABOVE',
        tier,
      },
      status: passed ? 'PASSED' : 'FAILED',
      actualValue: actual,
      expectedValue: tier,
      explanation: passed
        ? `Pressure tier constraint satisfied (${actual} not above ${tier}).`
        : `Pressure tier constraint failed (${actual} is above ${tier}).`,
      sources: ['STRUCTURED', 'PRESSURE'],
    };
  }

  /**
   * Legacy recovery evaluation
   *
   * This remains important because current chain instances only persist
   * recoveryTags, not the full authored structured recovery state.
   *
   * Matching policy:
   * - normalize every authored tag
   * - build a deterministic token bag from authoritative snapshot surfaces
   * - record per-tag evidence
   * - recovery is satisfied if ANY recovery tag matches
   */
  private evaluateLegacyRecovery(
    normalizedRecoveryTags: readonly string[],
    snapshot: RunStateSnapshot,
  ): LegacyRecoveryHit[] {
    if (normalizedRecoveryTags.length === 0) {
      return [];
    }

    const legacyBag = this.buildLegacyTokenBag(snapshot);
    const indexed = this.indexLegacyTokenBag(legacyBag);

    return normalizedRecoveryTags.map((tag) => {
      const match = indexed.get(tag) ?? null;
      const matched = match !== null;

      return {
        tag,
        normalizedTag: tag,
        matched,
        matchedValue: match?.value ?? null,
        matchedSection: match?.section ?? null,
        explanation: matched
          ? `Legacy tag "${tag}" matched token "${match!.value}" from ${match!.section}.`
          : `Legacy tag "${tag}" did not match the runtime compatibility bag.`,
      };
    });
  }

  /**
   * Compatibility bag construction. This is where we carefully widen the legacy
   * matcher beyond the original hand-only implementation without turning it
   * into an unbounded fuzzy matcher.
   */
  private buildLegacyTokenBag(
    snapshot: RunStateSnapshot,
  ): LegacyTokenEntry[] {
    const bag: LegacyTokenEntry[] = [];

    this.pushHandTokens(bag, snapshot.cards.hand);
    this.pushSimpleStringTokens(bag, snapshot.cards.lastPlayed, 'LAST_PLAYED');
    this.pushSimpleStringTokens(bag, snapshot.cards.discard, 'DISCARD');
    this.pushSimpleStringTokens(bag, snapshot.cards.exhaust, 'EXHAUST');
    this.pushSimpleStringTokens(bag, snapshot.cards.drawHistory, 'DRAW_HISTORY');
    this.pushGhostMarkerTokens(bag, snapshot);
    this.pushModeStateTokens(bag, snapshot.modeState);

    return bag;
  }

  /**
   * Hand-derived legacy tokens remain the most important compatibility source.
   */
  private pushHandTokens(
    bag: LegacyTokenEntry[],
    hand: readonly CardInstance[],
  ): void {
    for (const card of hand) {
      const descriptor = this.describeCard(card);

      for (const tag of descriptor.tags) {
        bag.push({
          value: tag,
          section: 'HAND_TAG',
        });
      }

      bag.push({
        value: descriptor.name,
        section: 'HAND_CARD_NAME',
      });

      bag.push({
        value: descriptor.definitionId,
        section: 'HAND_DEFINITION_ID',
      });

      bag.push({
        value: descriptor.deckType,
        section: 'HAND_DECK_TYPE',
      });

      bag.push({
        value: descriptor.educationalTag,
        section: 'HAND_EDUCATIONAL_TAG',
      });

      for (const timing of descriptor.timingClasses) {
        bag.push({
          value: timing,
          section: 'HAND_TIMING_CLASS',
        });
      }

      bag.push({
        value: descriptor.targeting,
        section: 'HAND_TARGETING',
      });
    }
  }

  /**
   * Simple list-like token projection.
   */
  private pushSimpleStringTokens(
    bag: LegacyTokenEntry[],
    values: readonly string[],
    section: LegacyBagSection,
  ): void {
    for (const value of values) {
      bag.push({
        value: this.normalize(value),
        section,
      });
    }
  }

  /**
   * Ghost marker projections remain narrow and deterministic.
   */
  private pushGhostMarkerTokens(
    bag: LegacyTokenEntry[],
    snapshot: RunStateSnapshot,
  ): void {
    for (const marker of snapshot.cards.ghostMarkers) {
      bag.push({
        value: this.normalize(marker.kind),
        section: 'GHOST_MARKER_KIND',
      });

      if (marker.cardId) {
        bag.push({
          value: this.normalize(marker.cardId),
          section: 'GHOST_MARKER_CARD_ID',
        });
      }
    }
  }

  /**
   * Mode-state projections allow legacy authored recovery tags to target
   * durable run-state semantics without needing a new RecoveryCondition kind.
   *
   * This remains intentionally curated instead of dumping raw object keys.
   */
  private pushModeStateTokens(
    bag: LegacyTokenEntry[],
    modeState: ModeState,
  ): void {
    for (const [playerId, role] of Object.entries(modeState.roleAssignments)) {
      bag.push({
        value: this.normalize(`${playerId}:${role}`),
        section: 'ROLE_ASSIGNMENT',
      });
      bag.push({
        value: this.normalize(role),
        section: 'ROLE_ASSIGNMENT',
      });
    }

    for (const handicapId of modeState.handicapIds) {
      bag.push({
        value: this.normalize(handicapId),
        section: 'HANDICAP_ID',
      });
    }

    if (modeState.advantageId) {
      bag.push({
        value: this.normalize(modeState.advantageId),
        section: 'ADVANTAGE_ID',
      });
    }

    if (modeState.holdEnabled) {
      bag.push({
        value: SPECIAL_MODE_FLAGS.HOLD_ENABLED,
        section: 'SPECIAL_MODE_FLAG',
      });
    }
    if (modeState.loadoutEnabled) {
      bag.push({
        value: SPECIAL_MODE_FLAGS.LOADOUT_ENABLED,
        section: 'SPECIAL_MODE_FLAG',
      });
    }
    if (modeState.sharedTreasury) {
      bag.push({
        value: SPECIAL_MODE_FLAGS.SHARED_TREASURY,
        section: 'SPECIAL_MODE_FLAG',
      });
    }
    if (modeState.legendMarkersEnabled) {
      bag.push({
        value: SPECIAL_MODE_FLAGS.LEGEND_MARKERS_ENABLED,
        section: 'SPECIAL_MODE_FLAG',
      });
    }
    if (modeState.sharedOpportunityDeck) {
      bag.push({
        value: SPECIAL_MODE_FLAGS.SHARED_OPPORTUNITY_DECK,
        section: 'SPECIAL_MODE_FLAG',
      });
    }
    if (modeState.roleLockEnabled) {
      bag.push({
        value: SPECIAL_MODE_FLAGS.ROLE_LOCK_ENABLED,
        section: 'SPECIAL_MODE_FLAG',
      });
    }
    if (modeState.bleedMode) {
      bag.push({
        value: SPECIAL_MODE_FLAGS.BLEED_MODE,
        section: 'SPECIAL_MODE_FLAG',
      });
    }
  }

  /**
   * Stable first-match indexing for legacy matching.
   */
  private indexLegacyTokenBag(
    bag: readonly LegacyTokenEntry[],
  ): Map<string, LegacyTokenEntry> {
    const index = new Map<string, LegacyTokenEntry>();

    for (const entry of bag) {
      if (!entry.value) {
        continue;
      }
      if (!index.has(entry.value)) {
        index.set(entry.value, entry);
      }
    }

    return index;
  }

  /**
   * Collects effective recovery tags for evaluation.
   *
   * Priority:
   * 1. chain.recoveryTags (the runtime-persisted legacy surface)
   * 2. template.recoveryTags (fallback authored default)
   *
   * We merge both rather than choosing only one to avoid breaking runs that
   * contain partial persisted/runtime authored state.
   */
  private collectRecoveryTagsForEvaluation(
    chain: CascadeChainInstance,
    template: CascadeTemplate,
  ): readonly string[] {
    return [
      ...new Set([
        ...chain.recoveryTags,
        ...template.recoveryTags,
      ]),
    ];
  }

  /**
   * Card descriptor projection.
   *
   * The runtime instance already carries derived tags/timing/targeting after
   * mode overlays, which is exactly what recovery should reason over.
   */
  private describeCard(card: CardInstance): NormalizedCardDescriptor {
    const name = this.normalize(card.card.name);
    const definitionId = this.normalize(card.definitionId);
    const deckType = this.normalize(card.card.deckType);
    const educationalTag = this.normalize(card.card.educationalTag);
    const targeting = this.normalize(card.targeting);

    const timingClasses = this.normalizeList(
      (card.timingClass ?? []) as readonly string[],
    );

    const tags = this.normalizeList([
      ...(card.tags ?? []),
      ...(card.card.tags ?? []),
      card.overlayAppliedForMode,
      deckType,
      educationalTag,
      targeting,
      ...timingClasses,
    ]);

    const allSearchTokens = this.normalizeList([
      ...tags,
      name,
      definitionId,
      deckType,
      educationalTag,
      targeting,
      ...timingClasses,
    ]);

    return {
      instanceId: card.instanceId,
      definitionId,
      name,
      deckType,
      educationalTag,
      targeting,
      timingClasses,
      tags,
      allSearchTokens,
    };
  }

  /**
   * Summary builder
   */
  private buildSummary(
    template: CascadeTemplate,
    structuredEvaluations: readonly RecoveryConditionEvaluation[],
    structuredSatisfied: boolean,
    normalizedRecoveryTags: readonly string[],
    legacyHits: readonly LegacyRecoveryHit[],
    legacySatisfied: boolean,
  ): string {
    const parts: string[] = [];

    if (template.recovery.length > 0) {
      parts.push(
        structuredSatisfied
          ? EXPLANATIONS.STRUCTURED_ALL_PASSED
          : EXPLANATIONS.STRUCTURED_FAILED,
      );

      const failed = structuredEvaluations
        .filter((evaluation) => evaluation.status === 'FAILED')
        .map((evaluation) => evaluation.explanation);

      if (failed.length > 0) {
        parts.push(`Structured failures: ${failed.join(' | ')}`);
      }
    } else {
      parts.push(EXPLANATIONS.STRUCTURED_NOT_AUTHORED);
    }

    if (normalizedRecoveryTags.length > 0) {
      const matched = legacyHits.filter((hit) => hit.matched);
      parts.push(
        legacySatisfied
          ? `${EXPLANATIONS.LEGACY_MATCHED} Matched: ${matched.map((hit) => `${hit.tag}@${hit.matchedSection}`).join(', ')}.`
          : EXPLANATIONS.LEGACY_NOT_MATCHED,
      );
    } else {
      parts.push(EXPLANATIONS.LEGACY_NOT_AUTHORED);
    }

    return parts.join(' ');
  }

  /**
   * Tier ranking helper.
   */
  private tierRank(tier: PressureTier): number {
    return PRESSURE_TIER_ORDER[tier] ?? 99;
  }

  /**
   * Ratio formatter — deterministic and concise.
   */
  private formatRatio(value: number): string {
    return Number.isFinite(value) ? value.toFixed(3) : '0.000';
  }

  /**
   * List normalization with de-duplication and empty filtering.
   */
  private normalizeList(values: readonly string[]): string[] {
    const output: string[] = [];
    const seen = new Set<string>();

    for (const value of values) {
      const normalized = this.normalize(value);
      if (!normalized) {
        continue;
      }
      if (seen.has(normalized)) {
        continue;
      }
      seen.add(normalized);
      output.push(normalized);
    }

    return output;
  }

  /**
   * Stable normalization across tag-era and structured-era authored content.
   */
  private normalize(value: string | null | undefined): string {
    if (!value) {
      return '';
    }

    return value
      .trim()
      .toLowerCase()
      .replace(/[\s\-]+/g, '_')
      .replace(/[^\w:]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  // ---------------------------------------------------------------------------
  // Additive utility surfaces below this line
  // ---------------------------------------------------------------------------

  /**
   * Returns true if the template authored any structured recovery.
   */
  public hasStructuredRecovery(template: CascadeTemplate): boolean {
    return template.recovery.length > 0;
  }

  /**
   * Returns true if the chain/template authored any legacy compatibility tags.
   */
  public hasLegacyRecoveryTags(
    chain: CascadeChainInstance,
    template: CascadeTemplate,
  ): boolean {
    return this.collectRecoveryTagsForEvaluation(chain, template).length > 0;
  }

  /**
   * Exposes normalized legacy recovery tags for tooling/tests.
   */
  public getNormalizedRecoveryTags(
    chain: CascadeChainInstance,
    template: CascadeTemplate,
  ): readonly string[] {
    return this.normalizeList(
      this.collectRecoveryTagsForEvaluation(chain, template),
    );
  }

  /**
   * Exposes the authoritative legacy token bag. This is intentionally additive
   * and can be used by tests and replay/debug tooling.
   */
  public getLegacyTokenBag(snapshot: RunStateSnapshot): readonly string[] {
    const bag = this.buildLegacyTokenBag(snapshot);
    return [
      ...new Set(
        bag
          .map((entry) => entry.value)
          .filter((value) => value.length > 0),
      ),
    ];
  }

  /**
   * Returns a richer labeled bag useful for operator diagnostics.
   */
  public getLabeledLegacyTokenBag(
    snapshot: RunStateSnapshot,
  ): readonly Readonly<LegacyTokenEntry>[] {
    return this.buildLegacyTokenBag(snapshot);
  }

  /**
   * Evaluates only the structured conditions and returns whether all authored
   * structured conditions passed.
   */
  public evaluateStructuredOnly(
    template: CascadeTemplate,
    snapshot: RunStateSnapshot,
  ): {
    readonly passed: boolean;
    readonly evaluations: readonly RecoveryConditionEvaluation[];
  } {
    const evaluations = this.evaluateStructuredConditions(
      template.recovery,
      snapshot,
    );

    return {
      passed:
        template.recovery.length > 0 &&
        evaluations.length > 0 &&
        evaluations.every((evaluation) => evaluation.status === 'PASSED'),
      evaluations,
    };
  }

  /**
   * Evaluates only legacy compatibility recovery.
   */
  public evaluateLegacyOnly(
    chain: CascadeChainInstance,
    snapshot: RunStateSnapshot,
    template: CascadeTemplate,
  ): {
    readonly passed: boolean;
    readonly hits: readonly LegacyRecoveryHit[];
    readonly normalizedRecoveryTags: readonly string[];
  } {
    const normalizedRecoveryTags = this.getNormalizedRecoveryTags(chain, template);
    const hits = this.evaluateLegacyRecovery(normalizedRecoveryTags, snapshot);

    return {
      passed: hits.some((hit) => hit.matched),
      hits,
      normalizedRecoveryTags,
    };
  }

  /**
   * Runtime convenience method for recovery narration or analytics surfaces.
   */
  public getRecoveryEvidenceSources(
    chain: CascadeChainInstance,
    snapshot: RunStateSnapshot,
    template: CascadeTemplate,
  ): readonly RecoveryEvidenceSource[] {
    const report = this.evaluate(chain, snapshot, template);
    const sources = new Set<RecoveryEvidenceSource>();

    for (const evaluation of report.structuredEvaluations) {
      for (const source of evaluation.sources) {
        sources.add(source);
      }
    }

    if (report.legacyHits.length > 0) {
      sources.add('LEGACY_TAG');
    }

    return [...sources];
  }

  /**
   * Returns the first failing structured recovery explanation if any.
   */
  public getFirstStructuredFailure(
    template: CascadeTemplate,
    snapshot: RunStateSnapshot,
  ): string | null {
    const evaluations = this.evaluateStructuredConditions(
      template.recovery,
      snapshot,
    );

    const firstFailure = evaluations.find(
      (evaluation) => evaluation.status === 'FAILED',
    );

    return firstFailure?.explanation ?? null;
  }

  /**
   * Returns the matching legacy tag strings if the legacy matcher succeeds.
   */
  public getMatchedLegacyTags(
    chain: CascadeChainInstance,
    snapshot: RunStateSnapshot,
    template: CascadeTemplate,
  ): readonly string[] {
    const result = this.evaluateLegacyOnly(chain, snapshot, template);
    return result.hits
      .filter((hit) => hit.matched)
      .map((hit) => hit.tag);
  }

  /**
   * Returns whether the current hand contains any token that would satisfy the
   * authored structured CARD_TAG_ANY recovery conditions.
   */
  public handCouldSatisfyCardTagRecovery(
    template: CascadeTemplate,
    snapshot: RunStateSnapshot,
  ): boolean {
    const cardTagConditions = template.recovery.filter(
      (condition): condition is Extract<RecoveryCondition, { kind: 'CARD_TAG_ANY' }> =>
        condition.kind === 'CARD_TAG_ANY',
    );

    if (cardTagConditions.length === 0) {
      return false;
    }

    const descriptors = snapshot.cards.hand.map((card) => this.describeCard(card));
    const bag = new Set<string>();
    for (const descriptor of descriptors) {
      for (const token of descriptor.allSearchTokens) {
        bag.add(token);
      }
    }

    return cardTagConditions.some((condition) =>
      this.normalizeList(condition.tags).some((tag) => bag.has(tag)),
    );
  }

  /**
   * Returns a compact debug object describing hand/search token expansion.
   */
  public getHandSearchProjection(
    snapshot: RunStateSnapshot,
  ): readonly Readonly<NormalizedCardDescriptor>[] {
    return snapshot.cards.hand.map((card) => this.describeCard(card));
  }

  /**
   * Returns whether the snapshot is in a high-risk state where recovery failure
   * is especially likely to matter. Additive diagnostic only.
   */
  public isRecoveryCriticalNow(snapshot: RunStateSnapshot): boolean {
    return (
      snapshot.pressure.tier === 'T4' ||
      snapshot.pressure.band === 'CRITICAL' ||
      snapshot.shield.weakestLayerRatio <= 0.20 ||
      snapshot.economy.cash < 0
    );
  }

  /**
   * Returns a compact one-line operator summary.
   */
  public getOperatorSummary(
    chain: CascadeChainInstance,
    snapshot: RunStateSnapshot,
    template: CascadeTemplate,
  ): string {
    const report = this.evaluate(chain, snapshot, template);

    const parts = [
      `chain=${chain.chainId}`,
      `template=${chain.templateId}`,
      `recovered=${String(report.recovered)}`,
      `structured=${String(report.structuredSatisfied)}`,
      `legacy=${String(report.legacySatisfied)}`,
      `pressure=${snapshot.pressure.tier}`,
      `cash=${snapshot.economy.cash}`,
      `weakestShield=${this.formatRatio(snapshot.shield.weakestLayerRatio)}`,
    ];

    return parts.join(' ');
  }

  /**
   * Returns whether any authored recovery route exists at all.
   */
  public hasAnyRecoveryRoute(
    chain: CascadeChainInstance,
    template: CascadeTemplate,
  ): boolean {
    return template.recovery.length > 0 ||
      this.collectRecoveryTagsForEvaluation(chain, template).length > 0;
  }

  /**
   * Exposes whether the legacy matcher would currently succeed from hand-only
   * evidence. Helpful when tuning authored recovery tags to avoid over-broad
   * discard/history matches.
   */
  public evaluateLegacyFromHandOnly(
    chain: CascadeChainInstance,
    snapshot: RunStateSnapshot,
    template: CascadeTemplate,
  ): {
    readonly passed: boolean;
    readonly hits: readonly LegacyRecoveryHit[];
  } {
    const normalizedRecoveryTags = this.getNormalizedRecoveryTags(chain, template);

    if (normalizedRecoveryTags.length === 0) {
      return {
        passed: false,
        hits: [],
      };
    }

    const bag: LegacyTokenEntry[] = [];
    this.pushHandTokens(bag, snapshot.cards.hand);
    const indexed = this.indexLegacyTokenBag(bag);

    const hits = normalizedRecoveryTags.map((tag) => {
      const match = indexed.get(tag) ?? null;
      return {
        tag,
        normalizedTag: tag,
        matched: match !== null,
        matchedValue: match?.value ?? null,
        matchedSection: match?.section ?? null,
        explanation: match
          ? `Legacy tag "${tag}" matched hand-only token "${match.value}" from ${match.section}.`
          : `Legacy tag "${tag}" did not match any hand-only token.`,
      } satisfies LegacyRecoveryHit;
    });

    return {
      passed: hits.some((hit) => hit.matched),
      hits,
    };
  }

  /**
   * Returns whether discard/history evidence is what caused legacy recovery.
   * Useful for balancing authored tags if this becomes too permissive.
   */
  public legacyRecoveryUsedNonHandEvidence(
    chain: CascadeChainInstance,
    snapshot: RunStateSnapshot,
    template: CascadeTemplate,
  ): boolean {
    const result = this.evaluateLegacyOnly(chain, snapshot, template);

    return result.hits.some((hit) => {
      if (!hit.matched) {
        return false;
      }
      return hit.matchedSection !== 'HAND_TAG' &&
        hit.matchedSection !== 'HAND_CARD_NAME' &&
        hit.matchedSection !== 'HAND_DEFINITION_ID' &&
        hit.matchedSection !== 'HAND_DECK_TYPE' &&
        hit.matchedSection !== 'HAND_EDUCATIONAL_TAG' &&
        hit.matchedSection !== 'HAND_TIMING_CLASS' &&
        hit.matchedSection !== 'HAND_TARGETING';
    });
  }

  /**
   * Returns the current weakest shield layer state.
   */
  public getWeakestShieldLayer(
    snapshot: RunStateSnapshot,
  ): ShieldLayerState | null {
    return (
      snapshot.shield.layers.find(
        (layer) => layer.layerId === snapshot.shield.weakestLayerId,
      ) ?? null
    );
  }

  /**
   * Returns whether a given pressure tier would satisfy a
   * PRESSURE_NOT_ABOVE authored condition.
   */
  public pressureWouldSatisfyNotAbove(
    actual: PressureTier,
    expectedMax: PressureTier,
  ): boolean {
    return this.tierRank(actual) <= this.tierRank(expectedMax);
  }

  /**
   * Returns a projected pass/fail matrix for every structured condition kind in
   * the template. Useful for audit surfaces and tests.
   */
  public getStructuredConditionMatrix(
    template: CascadeTemplate,
    snapshot: RunStateSnapshot,
  ): readonly Readonly<{
    readonly kind: RecoveryCondition['kind'];
    readonly passed: boolean;
    readonly explanation: string;
  }>[] {
    return this.evaluateStructuredConditions(template.recovery, snapshot).map(
      (evaluation) => ({
        kind: evaluation.condition.kind,
        passed: evaluation.status === 'PASSED',
        explanation: evaluation.explanation,
      }),
    );
  }

  // ---------------------------------------------------------------------------
  // ML Analytics & Deep Recovery Scoring
  // ---------------------------------------------------------------------------

  /**
   * Returns the canonical empty evaluations reference from the types module.
   *
   * This is the authoritative frozen-empty array of `types.RecoveryConditionEvaluation`
   * objects used by tooling, read models, and replay descriptors when a template
   * authors no structured conditions or is positively-polarized. Consumers that
   * build evaluation bundles from types.ts factory functions should use this as
   * their baseline empty state rather than constructing a new `[]` each call.
   */
  public getCanonicalEmptyEvaluations(): typeof EMPTY_RECOVERY_EVALUATIONS {
    return EMPTY_RECOVERY_EVALUATIONS;
  }

  /**
   * Returns the canonical vocabulary of recovery condition statuses as exported
   * by the types module. This is the authoritative status registry for tooling,
   * chat narration, and audit systems.
   *
   * Covers: MATCHED, UNMATCHED, NOT_APPLICABLE, EMPTY_INPUT, INVALID
   */
  public listCanonicalRecoveryStatuses(): readonly CanonicalRecoveryStatus[] {
    return RECOVERY_CONDITION_STATUSES;
  }

  /**
   * Maps canonical status labels from types.ts to the checker's internal
   * evaluation status vocabulary. Bridges the two separate status systems:
   * - types.ts: MATCHED / UNMATCHED / NOT_APPLICABLE / EMPTY_INPUT / INVALID
   * - checker: PASSED / FAILED / SKIPPED / NOT_APPLICABLE
   */
  public mapToCanonicalStatus(
    localStatus: RecoveryConditionStatus,
  ): CanonicalRecoveryStatus {
    switch (localStatus) {
      case 'PASSED':
        return 'MATCHED';
      case 'FAILED':
        return 'UNMATCHED';
      case 'SKIPPED':
        return 'NOT_APPLICABLE';
      case 'NOT_APPLICABLE':
        return 'NOT_APPLICABLE';
      default: {
        const _exhaustive: never = localStatus;
        void _exhaustive;
        return 'INVALID';
      }
    }
  }

  /**
   * Lists the comparator type for each recovery condition in a template.
   *
   * Comparators describe the logical operator applied to evaluate the condition:
   * - ANY_IN_SET: passes if any token in the input set matches (CARD_TAG_ANY, LAST_PLAYED_TAG_ANY)
   * - NUMERIC_AT_LEAST: passes if actual >= required threshold (CASH_MIN, shield ratios, trust)
   * - NUMERIC_AT_MOST: passes if actual <= required ceiling (HEAT_MAX)
   * - TIER_AT_MOST: passes if pressure tier rank <= required tier rank (PRESSURE_NOT_ABOVE)
   */
  public listConditionComparators(
    template: CascadeTemplate,
  ): readonly Readonly<{
    readonly conditionIndex: number;
    readonly kind: RecoveryConditionKind;
    readonly comparator: RecoveryConditionComparator;
  }>[] {
    return Object.freeze(
      template.recovery.map((condition, index) => ({
        conditionIndex: index,
        kind: condition.kind as RecoveryConditionKind,
        comparator: RECOVERY_CONDITION_COMPARATOR_BY_KIND[condition.kind as RecoveryConditionKind],
      })),
    );
  }

  /**
   * Returns a comparator for a single condition kind.
   * Uses RECOVERY_CONDITION_COMPARATOR_BY_KIND from the types module.
   */
  public getComparatorForKind(kind: RecoveryConditionKind): RecoveryConditionComparator {
    return RECOVERY_CONDITION_COMPARATOR_BY_KIND[kind];
  }

  /**
   * Computes a 0–1 proximity score for each authored structured recovery
   * condition against the current snapshot.
   *
   * A score of 1.0 means the condition is currently passing or exactly at
   * threshold. A score of 0.0 means the condition is maximally far from
   * passing.
   *
   * Proximity is comparator-aware:
   * - ANY_IN_SET: fraction of required tokens present
   * - NUMERIC_AT_LEAST: actual / required (clamped to 1)
   * - NUMERIC_AT_MOST: 1 - max(actual - required, 0) / max(actual + 1, 1)
   * - TIER_AT_MOST: 1 if passing, 0 if failing (discrete)
   */
  public computeConditionProximities(
    template: CascadeTemplate,
    snapshot: RunStateSnapshot,
  ): readonly Readonly<{
    readonly conditionIndex: number;
    readonly kind: RecoveryConditionKind;
    readonly comparator: RecoveryConditionComparator;
    readonly proximity: number;
    readonly status: RecoveryConditionStatus;
    readonly explanation: string;
  }>[] {
    return Object.freeze(
      template.recovery.map((condition, index) => {
        const kind = condition.kind as RecoveryConditionKind;
        const comparator = RECOVERY_CONDITION_COMPARATOR_BY_KIND[kind];
        const evaluation = this.evaluateCondition(condition, snapshot);
        const proximity = this.computeSingleConditionProximity(condition, snapshot, evaluation);

        return {
          conditionIndex: index,
          kind,
          comparator,
          proximity,
          status: evaluation.status,
          explanation: evaluation.explanation,
        };
      }),
    );
  }

  /**
   * Computes a scalar proximity score [0, 1] for a single condition relative
   * to the current snapshot. Used internally by `computeConditionProximities`
   * and the ML feature vector builder.
   */
  private computeSingleConditionProximity(
    condition: RecoveryCondition,
    snapshot: RunStateSnapshot,
    evaluation: RecoveryConditionEvaluation,
  ): number {
    if (evaluation.status === 'PASSED') {
      return 1.0;
    }

    const comparator = RECOVERY_CONDITION_COMPARATOR_BY_KIND[condition.kind as RecoveryConditionKind];

    switch (condition.kind) {
      case 'CARD_TAG_ANY':
      case 'LAST_PLAYED_TAG_ANY': {
        if (condition.tags.length === 0) {
          return 0;
        }
        const required = this.normalizeList(condition.tags);
        const bag = this.buildConditionTokenBag(condition, snapshot);
        const matched = required.filter((tag) => bag.has(tag)).length;
        return matched / required.length;
      }

      case 'CASH_MIN': {
        const actual = snapshot.economy.cash;
        if (condition.amount <= 0) {
          return 1.0;
        }
        return Math.min(1, Math.max(0, actual / condition.amount));
      }

      case 'WEAKEST_SHIELD_RATIO_MIN': {
        const actual = snapshot.shield.weakestLayerRatio;
        if (condition.ratio <= 0) {
          return 1.0;
        }
        return Math.min(1, Math.max(0, actual / condition.ratio));
      }

      case 'ALL_SHIELDS_RATIO_MIN': {
        if (snapshot.shield.layers.length === 0) {
          return 0;
        }
        const totalProximity = snapshot.shield.layers.reduce(
          (sum, layer) => sum + Math.min(1, Math.max(0, layer.integrityRatio / condition.ratio)),
          0,
        );
        return totalProximity / snapshot.shield.layers.length;
      }

      case 'TRUST_ANY_MIN': {
        const entries = Object.values(snapshot.modeState.trustScores);
        if (entries.length === 0 || condition.score <= 0) {
          return 0;
        }
        const bestProximity = Math.max(...entries.map((v) => Math.min(1, Math.max(0, v / condition.score))));
        return bestProximity;
      }

      case 'HEAT_MAX': {
        const actual = snapshot.economy.haterHeat;
        if (actual <= condition.amount) {
          return 1.0;
        }
        const excess = actual - condition.amount;
        const scale = Math.max(actual, 1);
        return Math.max(0, 1 - excess / scale);
      }

      case 'PRESSURE_NOT_ABOVE': {
        return this.tierRank(snapshot.pressure.tier) <= this.tierRank(condition.tier) ? 1.0 : 0.0;
      }

      default: {
        void comparator;
        return 0;
      }
    }
  }

  /**
   * Builds a token set for ANY_IN_SET condition proximity scoring.
   */
  private buildConditionTokenBag(
    condition: RecoveryCondition,
    snapshot: RunStateSnapshot,
  ): Set<string> {
    const bag = new Set<string>();

    if (condition.kind === 'CARD_TAG_ANY') {
      for (const card of snapshot.cards.hand) {
        for (const token of this.describeCard(card).allSearchTokens) {
          bag.add(token);
        }
      }
    } else if (condition.kind === 'LAST_PLAYED_TAG_ANY') {
      for (const token of this.normalizeList(snapshot.cards.lastPlayed)) {
        bag.add(token);
      }
    }

    return bag;
  }

  /**
   * Computes an ML-oriented recovery readiness score for a given chain.
   *
   * Score composition:
   * - Structured condition proximity average (weighted 0.7)
   * - Legacy tag coverage ratio (weighted 0.3)
   * - Output clamped to [0, 1]
   *
   * A score of 1.0 means the chain is fully recovered or recovery conditions
   * are maximally satisfied. A score near 0 means recovery is far off.
   *
   * For positive chains, always returns 0 (positive chains never recover).
   */
  public computeRecoveryReadinessScore(
    chain: CascadeChainInstance,
    snapshot: RunStateSnapshot,
    template: CascadeTemplate,
  ): number {
    if (chain.positive) {
      return 0;
    }

    const proximities = this.computeConditionProximities(template, snapshot);
    const avgStructuredProximity =
      proximities.length > 0
        ? proximities.reduce((sum, p) => sum + p.proximity, 0) / proximities.length
        : 0;

    const normalizedRecoveryTags = this.getNormalizedRecoveryTags(chain, template);
    const legacyBag = this.buildLegacyTokenBag(snapshot);
    const indexed = this.indexLegacyTokenBag(legacyBag);
    const legacyCoverage =
      normalizedRecoveryTags.length > 0
        ? normalizedRecoveryTags.filter((tag) => indexed.has(tag)).length /
          normalizedRecoveryTags.length
        : 0;

    const hasStructured = template.recovery.length > 0;
    const hasLegacy = normalizedRecoveryTags.length > 0;

    if (!hasStructured && !hasLegacy) {
      return 0;
    }

    if (hasStructured && !hasLegacy) {
      return Math.min(1, avgStructuredProximity);
    }

    if (!hasStructured && hasLegacy) {
      return Math.min(1, legacyCoverage);
    }

    return Math.min(1, avgStructuredProximity * 0.7 + legacyCoverage * 0.3);
  }

  /**
   * Computes a fixed-length 12-element ML feature vector for recovery analysis.
   *
   * Dimension layout:
   *   [0]  cash proximity (CASH_MIN conditions averaged; 0 if none authored)
   *   [1]  weakest shield proximity (WEAKEST_SHIELD_RATIO_MIN; 0 if not authored)
   *   [2]  all shields avg proximity (ALL_SHIELDS_RATIO_MIN; 0 if not authored)
   *   [3]  trust any proximity (TRUST_ANY_MIN; 0 if not authored)
   *   [4]  heat proximity (HEAT_MAX; 0 if not authored)
   *   [5]  pressure proximity (PRESSURE_NOT_ABOVE; 0 if not authored)
   *   [6]  hand tag any proximity (CARD_TAG_ANY; 0 if not authored)
   *   [7]  last played tag proximity (LAST_PLAYED_TAG_ANY; 0 if not authored)
   *   [8]  overall readiness score
   *   [9]  structured condition count normalized to [0, 1] over max 8 kinds
   *   [10] legacy recovery tag count normalized to [0, 1] over max 16 tags
   *   [11] has any recovery route (0 or 1)
   *
   * All values are in [0, 1]. Safe for direct use as neural network input.
   */
  public computeMLRecoveryFeatureVector(
    chain: CascadeChainInstance,
    snapshot: RunStateSnapshot,
    template: CascadeTemplate,
  ): readonly number[] {
    if (chain.positive) {
      return Object.freeze(new Array(12).fill(0) as number[]);
    }

    const proximities = this.computeConditionProximities(template, snapshot);

    const pickProximity = (kind: RecoveryConditionKind): number => {
      const entries = proximities.filter((p) => p.kind === kind);
      if (entries.length === 0) {
        return 0;
      }
      return entries.reduce((sum, p) => sum + p.proximity, 0) / entries.length;
    };

    const readiness = this.computeRecoveryReadinessScore(chain, snapshot, template);
    const normalizedTags = this.getNormalizedRecoveryTags(chain, template);
    const hasAny = this.hasAnyRecoveryRoute(chain, template) ? 1 : 0;

    return Object.freeze([
      pickProximity('CASH_MIN'),
      pickProximity('WEAKEST_SHIELD_RATIO_MIN'),
      pickProximity('ALL_SHIELDS_RATIO_MIN'),
      pickProximity('TRUST_ANY_MIN'),
      pickProximity('HEAT_MAX'),
      pickProximity('PRESSURE_NOT_ABOVE'),
      pickProximity('CARD_TAG_ANY'),
      pickProximity('LAST_PLAYED_TAG_ANY'),
      readiness,
      Math.min(1, template.recovery.length / 8),
      Math.min(1, normalizedTags.length / 16),
      hasAny,
    ]);
  }

  /**
   * Evaluates a batch of (chain, template) pairs against a single snapshot.
   *
   * Returns one `RecoveryEvaluationReport` per entry. The reports are ordered
   * to match the input array order.
   *
   * Useful for:
   * - Dashboard rendering of all active chains at once
   * - ML batch inference
   * - Replay tooling that needs recovery state for every active chain
   */
  public getBatchEvaluations(
    entries: readonly Readonly<{
      readonly chain: CascadeChainInstance;
      readonly template: CascadeTemplate;
    }>[],
    snapshot: RunStateSnapshot,
  ): readonly RecoveryEvaluationReport[] {
    return Object.freeze(
      entries.map(({ chain, template }) => this.evaluate(chain, snapshot, template)),
    );
  }

  /**
   * Evaluates whether recovery readiness has improved between two snapshots.
   *
   * Returns `true` if the readiness score in `after` is higher than in `before`.
   * Safe to use in tight tick loops.
   */
  public hasRecoveryImproved(
    chain: CascadeChainInstance,
    before: RunStateSnapshot,
    after: RunStateSnapshot,
    template: CascadeTemplate,
  ): boolean {
    const scoreBefore = this.computeRecoveryReadinessScore(chain, before, template);
    const scoreAfter = this.computeRecoveryReadinessScore(chain, after, template);
    return scoreAfter > scoreBefore;
  }

  /**
   * Computes a per-condition trend analysis between two consecutive snapshots.
   *
   * Uses RECOVERY_CONDITION_COMPARATOR_BY_KIND to determine the delta direction
   * for each condition. Returns a trend entry per authored condition.
   *
   * Trend values:
   * - IMPROVING: proximity increased by > 0.02
   * - STABLE: proximity change is within ±0.02
   * - WORSENING: proximity decreased by > 0.02
   */
  public computeRecoveryTrend(
    chain: CascadeChainInstance,
    before: RunStateSnapshot,
    after: RunStateSnapshot,
    template: CascadeTemplate,
  ): readonly Readonly<{
    readonly conditionIndex: number;
    readonly kind: RecoveryConditionKind;
    readonly comparator: RecoveryConditionComparator;
    readonly proximityBefore: number;
    readonly proximityAfter: number;
    readonly delta: number;
    readonly trend: 'IMPROVING' | 'STABLE' | 'WORSENING';
  }>[] {
    if (chain.positive) {
      return Object.freeze([]);
    }

    const beforeProximities = this.computeConditionProximities(template, before);
    const afterProximities = this.computeConditionProximities(template, after);

    return Object.freeze(
      template.recovery.map((condition, index) => {
        const kind = condition.kind as RecoveryConditionKind;
        const comparator = RECOVERY_CONDITION_COMPARATOR_BY_KIND[kind];
        const proximityBefore = beforeProximities[index]?.proximity ?? 0;
        const proximityAfter = afterProximities[index]?.proximity ?? 0;
        const delta = proximityAfter - proximityBefore;

        const TREND_THRESHOLD = 0.02;
        const trend: 'IMPROVING' | 'STABLE' | 'WORSENING' =
          delta > TREND_THRESHOLD
            ? 'IMPROVING'
            : delta < -TREND_THRESHOLD
            ? 'WORSENING'
            : 'STABLE';

        return {
          conditionIndex: index,
          kind,
          comparator,
          proximityBefore,
          proximityAfter,
          delta,
          trend,
        };
      }),
    );
  }

  /**
   * Returns a human-readable gap summary describing how far the snapshot is
   * from satisfying each authored recovery condition.
   *
   * Useful for:
   * - Chat layer "what would help recover this chain" narration
   * - Debug tooling / operator dashboards
   * - Hint systems that guide player action toward recovery
   */
  public getRecoveryGapSummary(
    template: CascadeTemplate,
    snapshot: RunStateSnapshot,
  ): string {
    if (template.recovery.length === 0) {
      return 'No structured recovery conditions authored.';
    }

    const proximities = this.computeConditionProximities(template, snapshot);
    const gaps = proximities
      .filter((p) => p.proximity < 1.0)
      .map((p) => {
        const pct = Math.round(p.proximity * 100);
        return `${p.kind} [${pct}% satisfied] — ${p.explanation}`;
      });

    if (gaps.length === 0) {
      return 'All structured conditions satisfied.';
    }

    return `${gaps.length} condition(s) not yet satisfied:\n${gaps.join('\n')}`;
  }

  /**
   * Computes the canonical recovery condition status for a single condition
   * evaluated against the given snapshot.
   *
   * Maps the internal evaluation status to the types.ts canonical vocabulary:
   * MATCHED / UNMATCHED / NOT_APPLICABLE / EMPTY_INPUT / INVALID
   */
  public getCanonicalConditionStatus(
    condition: RecoveryCondition,
    snapshot: RunStateSnapshot,
  ): CanonicalRecoveryStatus {
    const evaluation = this.evaluateCondition(condition, snapshot);
    return this.mapToCanonicalStatus(evaluation.status);
  }

  /**
   * Returns a full structured recovery audit for a template against a snapshot.
   *
   * Each entry includes:
   * - condition kind and index
   * - local status (PASSED/FAILED)
   * - canonical status (MATCHED/UNMATCHED)
   * - comparator type from RECOVERY_CONDITION_COMPARATOR_BY_KIND
   * - proximity score
   * - explanation text
   *
   * Suitable for:
   * - Full audit trail in proof generation
   * - Operator dashboards
   * - Replay annotation
   */
  public getFullRecoveryAudit(
    template: CascadeTemplate,
    snapshot: RunStateSnapshot,
  ): readonly Readonly<{
    readonly conditionIndex: number;
    readonly kind: RecoveryConditionKind;
    readonly comparator: RecoveryConditionComparator;
    readonly localStatus: RecoveryConditionStatus;
    readonly canonicalStatus: CanonicalRecoveryStatus;
    readonly proximity: number;
    readonly explanation: string;
  }>[] {
    return Object.freeze(
      template.recovery.map((condition, index) => {
        const kind = condition.kind as RecoveryConditionKind;
        const comparator = RECOVERY_CONDITION_COMPARATOR_BY_KIND[kind];
        const evaluation = this.evaluateCondition(condition, snapshot);
        const proximity = this.computeSingleConditionProximity(condition, snapshot, evaluation);
        const canonicalStatus = this.mapToCanonicalStatus(evaluation.status);

        return {
          conditionIndex: index,
          kind,
          comparator,
          localStatus: evaluation.status,
          canonicalStatus,
          proximity,
          explanation: evaluation.explanation,
        };
      }),
    );
  }

  /**
   * Returns whether the snapshot state is sufficient to satisfy at least one
   * NUMERIC_AT_LEAST condition in the template. Used to quickly gate recovery
   * hint generation without evaluating the full condition set.
   */
  public hasAnyNumericAtLeastConditionMet(
    template: CascadeTemplate,
    snapshot: RunStateSnapshot,
  ): boolean {
    const numericKinds: readonly RecoveryConditionKind[] = [
      'CASH_MIN',
      'WEAKEST_SHIELD_RATIO_MIN',
      'ALL_SHIELDS_RATIO_MIN',
      'TRUST_ANY_MIN',
    ];

    return template.recovery.some((condition) => {
      if (!numericKinds.includes(condition.kind as RecoveryConditionKind)) {
        return false;
      }
      const comparator = RECOVERY_CONDITION_COMPARATOR_BY_KIND[condition.kind as RecoveryConditionKind];
      if (comparator !== 'NUMERIC_AT_LEAST') {
        return false;
      }
      const evaluation = this.evaluateCondition(condition, snapshot);
      return evaluation.status === 'PASSED';
    });
  }

  /**
   * Returns a count breakdown of how many conditions are passing, failing, and
   * at each proximity tier (<25%, 25-75%, >75%) for the given template.
   *
   * Useful for dashboard metrics and ML reward shaping inputs.
   */
  public getRecoveryProgressionStats(
    template: CascadeTemplate,
    snapshot: RunStateSnapshot,
  ): Readonly<{
    readonly totalConditions: number;
    readonly passingCount: number;
    readonly failingCount: number;
    readonly nearMissCount: number;
    readonly lowProximityCount: number;
    readonly averageProximity: number;
    readonly allPassing: boolean;
  }> {
    const proximities = this.computeConditionProximities(template, snapshot);

    if (proximities.length === 0) {
      return Object.freeze({
        totalConditions: 0,
        passingCount: 0,
        failingCount: 0,
        nearMissCount: 0,
        lowProximityCount: 0,
        averageProximity: 0,
        allPassing: false,
      });
    }

    const passingCount = proximities.filter((p) => p.proximity >= 1.0).length;
    const nearMissCount = proximities.filter((p) => p.proximity >= 0.75 && p.proximity < 1.0).length;
    const lowProximityCount = proximities.filter((p) => p.proximity < 0.25).length;
    const failingCount = proximities.length - passingCount;
    const averageProximity =
      proximities.reduce((sum, p) => sum + p.proximity, 0) / proximities.length;

    return Object.freeze({
      totalConditions: proximities.length,
      passingCount,
      failingCount,
      nearMissCount,
      lowProximityCount,
      averageProximity,
      allPassing: passingCount === proximities.length,
    });
  }
}
