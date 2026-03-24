/*
 * ════════════════════════════════════════════════════════════════════════════════
 * POINT ZERO ONE — BACKEND ENGINE CORE
 * /backend/src/game/engine/cards/CardTimingValidator.ts
 * ------------------------------------------------------------------------------
 * Backend-authoritative timing legality resolver for Point Zero One card runtime.
 *
 * Doctrine:
 * - backend timing legality is authoritative
 * - timing windows are mode-native, snapshot-derived, and replay-deterministic
 * - legality must be strong enough to reject UI abuse without erasing doctrine
 * - the same card can feel materially different across Empire / Predator /
 *   Syndicate / Phantom through mode-native timing context
 * - timing is not just a boolean gate; it is part of educational, tactical,
 *   social, and proof-bearing runtime identity
 * - this file stays contract-safe with the current backend primitives
 *
 * Public compatibility surface:
 * - isLegal(snapshot, card): boolean
 * - legalTimings(snapshot, card): TimingClass[]
 *
 * Additional rich APIs are exposed for legality services, replay, proof, audits,
 * diagnostics, and future chat / scene narration without changing callers that
 * only need the existing boolean + timing-list behavior.
 * ════════════════════════════════════════════════════════════════════════════════
 */

import type {
  CardInstance,
  DeckType,
  PressureTier,
  TimingClass,
} from '../core/GamePrimitives';
import type {
  PressureBand,
  RunStateSnapshot,
  RuntimeDecisionWindowSnapshot,
} from '../core/RunStateSnapshot';
import { CardRegistry } from './CardRegistry';

/* ──────────────────────────────────────────────────────────────────────────────
 * Canonical timing order / foundational constants
 * ──────────────────────────────────────────────────────────────────────────── */

const TIMING_ORDER: readonly TimingClass[] = Object.freeze([
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
] as const);

const END_WINDOW_MS = 30_000;
const END_WINDOW_TICKS_FALLBACK = 2;
const GHOST_MARKER_WINDOW_TICKS = 3;
const GHOST_MARKER_HARD_WINDOW_TICKS = 1;
const RESCUE_TRUST_THRESHOLD = 35;
const LOW_TRUST_THRESHOLD = 45;
const STABLE_TRUST_THRESHOLD = 65;
const CRITICAL_PRESSURE_SCORE = 0.9;
const HIGH_PRESSURE_SCORE = 0.72;
const ELEVATED_PRESSURE_SCORE = 0.5;
const HIGH_TENSION_SCORE = 0.72;
const ELEVATED_TENSION_SCORE = 0.5;
const HEAT_CRITICAL = 90;
const HEAT_HIGH = 70;
const TREASURY_STRESS_THRESHOLD = 0;
const CASCADE_RECENCY_TICKS = 2;
const PHASE_BOUNDARY_HIGH_URGENCY_REMAINING = 1;
const PHASE_BOUNDARY_MEDIUM_URGENCY_REMAINING = 2;
const PHASE_BOUNDARY_LOW_URGENCY_REMAINING = 4;
const DECISION_WINDOW_CARD_MATCH_WEIGHT = 4;
const DECISION_WINDOW_TIMING_MATCH_WEIGHT = 2;
const DECISION_WINDOW_GENERIC_MATCH_WEIGHT = 1;

const COUNTERABLE_ATTACK_CATEGORIES = Object.freeze([
  'EXTRACTION',
  'LOCK',
  'BREACH',
  'DEBT',
] as const);

const NEGATIVE_ATTACK_CATEGORIES = Object.freeze([
  'EXTRACTION',
  'LOCK',
  'DRAIN',
  'HEAT',
  'BREACH',
  'DEBT',
] as const);

const TIMING_QUARANTINE_WARNING_CODES = Object.freeze([
  'TIMING_QUARANTINE',
  'CARD_TIMING_QUARANTINE',
  'WINDOW_QUARANTINE',
  'REPLAY_TIMING_QUARANTINE',
] as const);

const FATE_WARNING_HINTS = Object.freeze([
  'FUBAR',
  'MISSED_OPPORTUNITY',
  'THREAT_ROUTED',
  'FATE_PRESSURE',
  'NEGATIVE_VARIANCE',
] as const);

const PRE_WINDOW_SOURCE_HINTS = Object.freeze([
  'pre',
  'prep',
  'phase_open',
  'phase_boundary',
  'setup',
  'hold',
] as const);

const POST_WINDOW_SOURCE_HINTS = Object.freeze([
  'post',
  'after',
  'resolution',
  'settle',
  'summary',
] as const);

const FATE_WINDOW_SOURCE_HINTS = Object.freeze([
  'fate',
  'market',
  'variance',
  'reality',
  'hazard',
  'event',
] as const);

const COUNTER_WINDOW_SOURCE_HINTS = Object.freeze([
  'counter',
  'defend',
  'response',
  'extraction',
  'breach',
  'lock',
  'debt',
] as const);

const RESCUE_WINDOW_SOURCE_HINTS = Object.freeze([
  'rescue',
  'stabilize',
  'bleed',
  'critical',
  'intervention',
] as const);

const AID_WINDOW_SOURCE_HINTS = Object.freeze([
  'aid',
  'loan',
  'treasury',
  'contract',
  'support',
  'cooperate',
] as const);

const GBM_WINDOW_SOURCE_HINTS = Object.freeze([
  'ghost',
  'marker',
  'legend',
  'baseline',
  'phantom',
] as const);

const CAS_WINDOW_SOURCE_HINTS = Object.freeze([
  'cascade',
  'chain',
  'break',
  'interrupt',
  'spill',
] as const);

const PHZ_WINDOW_SOURCE_HINTS = Object.freeze([
  'phase',
  'boundary',
  'transition',
  'pivot',
] as const);

const PSK_WINDOW_SOURCE_HINTS = Object.freeze([
  'spike',
  'pressure',
  'surge',
  'critical',
  'escalate',
] as const);

const END_WINDOW_SOURCE_HINTS = Object.freeze([
  'end',
  'timeout',
  'budget',
  'final',
  'closing',
] as const);

/* ──────────────────────────────────────────────────────────────────────────────
 * Mode doctrine
 * ----------------------------------------------------------------------------
 * This is a timing floor/ceiling policy by mode. It does not replace per-card
 * timing declarations. It narrows or interprets them through mode identity.
 * ──────────────────────────────────────────────────────────────────────────── */

const MODE_TIMING_DOCTRINE: Readonly<Record<string, readonly TimingClass[]>> = Object.freeze({
  solo: Object.freeze([
    'PRE',
    'POST',
    'FATE',
    'CAS',
    'PHZ',
    'PSK',
    'END',
    'ANY',
  ] as readonly TimingClass[]),
  pvp: Object.freeze([
    'PRE',
    'POST',
    'CTR',
    'CAS',
    'PSK',
    'END',
    'ANY',
  ] as readonly TimingClass[]),
  coop: Object.freeze([
    'PRE',
    'POST',
    'RES',
    'AID',
    'CAS',
    'PSK',
    'END',
    'ANY',
  ] as readonly TimingClass[]),
  ghost: Object.freeze([
    'PRE',
    'POST',
    'FATE',
    'GBM',
    'CAS',
    'PSK',
    'END',
    'ANY',
  ] as readonly TimingClass[]),
});

/* ──────────────────────────────────────────────────────────────────────────────
 * Deck timing doctrine
 * ----------------------------------------------------------------------------
 * This is not a substitute for per-card timing declarations. It is a doctrine
 * lens used to detect implausible timing classes and enrich audits.
 * ──────────────────────────────────────────────────────────────────────────── */

const DECK_TIMING_DOCTRINE: Readonly<Record<DeckType, readonly TimingClass[]>> = Object.freeze({
  OPPORTUNITY: Object.freeze(['PRE', 'PHZ', 'ANY', 'END'] as readonly TimingClass[]),
  IPA: Object.freeze(['PRE', 'ANY', 'PHZ', 'END'] as readonly TimingClass[]),
  FUBAR: Object.freeze(['FATE', 'POST', 'ANY'] as readonly TimingClass[]),
  MISSED_OPPORTUNITY: Object.freeze(['POST', 'FATE', 'END'] as readonly TimingClass[]),
  PRIVILEGED: Object.freeze(['PRE', 'ANY', 'END', 'PSK'] as readonly TimingClass[]),
  SO: Object.freeze(['PRE', 'POST', 'FATE', 'CAS', 'PHZ', 'PSK', 'END', 'ANY'] as readonly TimingClass[]),
  SABOTAGE: Object.freeze(['PRE', 'POST', 'PSK', 'ANY'] as readonly TimingClass[]),
  COUNTER: Object.freeze(['CTR', 'POST'] as readonly TimingClass[]),
  AID: Object.freeze(['AID', 'RES', 'PRE', 'ANY'] as readonly TimingClass[]),
  RESCUE: Object.freeze(['RES', 'CAS', 'AID'] as readonly TimingClass[]),
  DISCIPLINE: Object.freeze(['PRE', 'GBM', 'ANY', 'END'] as readonly TimingClass[]),
  TRUST: Object.freeze(['ANY', 'POST', 'AID', 'RES'] as readonly TimingClass[]),
  BLUFF: Object.freeze(['PRE', 'POST', 'ANY', 'CTR'] as readonly TimingClass[]),
  GHOST: Object.freeze(['GBM', 'PRE', 'PSK', 'FATE', 'ANY'] as readonly TimingClass[]),
});

/* ──────────────────────────────────────────────────────────────────────────────
 * Tag timing doctrine
 * ----------------------------------------------------------------------------
 * Tags do not hardcode legality, but they are meaningful timing hints used for
 * audit weighting, prioritization, and selective doctrine reinforcement.
 * ──────────────────────────────────────────────────────────────────────────── */

const TAG_TIMING_DOCTRINE: Readonly<Record<string, readonly TimingClass[]>> = Object.freeze({
  liquidity: Object.freeze(['PRE', 'AID', 'RES', 'END', 'ANY'] as readonly TimingClass[]),
  scale: Object.freeze(['PRE', 'PHZ', 'ANY'] as readonly TimingClass[]),
  heat: Object.freeze(['POST', 'PSK', 'ANY'] as readonly TimingClass[]),
  income: Object.freeze(['PRE', 'PHZ', 'ANY', 'END'] as readonly TimingClass[]),
  resilience: Object.freeze(['FATE', 'CAS', 'RES', 'CTR', 'PSK', 'END', 'ANY'] as readonly TimingClass[]),
  tempo: Object.freeze(['PRE', 'POST', 'CTR', 'PSK', 'ANY'] as readonly TimingClass[]),
  sabotage: Object.freeze(['PRE', 'POST', 'PSK'] as readonly TimingClass[]),
  variance: Object.freeze(['FATE', 'GBM', 'PRE', 'ANY'] as readonly TimingClass[]),
  cascade: Object.freeze(['CAS', 'POST', 'PSK'] as readonly TimingClass[]),
  trust: Object.freeze(['AID', 'RES', 'POST', 'ANY'] as readonly TimingClass[]),
  divergence: Object.freeze(['GBM', 'PRE', 'PSK'] as readonly TimingClass[]),
  precision: Object.freeze(['GBM', 'PRE', 'CTR', 'ANY'] as readonly TimingClass[]),
  automation: Object.freeze(['PRE', 'PHZ', 'ANY'] as readonly TimingClass[]),
  recovery: Object.freeze(['RES', 'CAS', 'END'] as readonly TimingClass[]),
});

/* ──────────────────────────────────────────────────────────────────────────────
 * Reason / report types
 * ──────────────────────────────────────────────────────────────────────────── */

export type TimingReasonCode =
  | 'TIMING_ALLOWED'
  | 'TIMING_NOT_DECLARED_ON_CARD'
  | 'TIMING_BLOCKED_BY_OUTCOME_FINALIZED'
  | 'TIMING_BLOCKED_BY_INTEGRITY_QUARANTINE'
  | 'TIMING_BLOCKED_BY_WARNING_QUARANTINE'
  | 'TIMING_BLOCKED_BY_CARD_MODE_MISMATCH'
  | 'TIMING_BLOCKED_BY_CARD_DECLARATIVE_MODE'
  | 'TIMING_BLOCKED_BY_CARD_DECAY_EXPIRED'
  | 'TIMING_BLOCKED_BY_MODE_DOCTRINE'
  | 'TIMING_BLOCKED_BY_DECK_DOCTRINE'
  | 'TIMING_SUPPORTED_BY_TAG_DOCTRINE'
  | 'TIMING_BLOCKED_BY_RUNTIME_RULE'
  | 'TIMING_ALLOWED_BY_ANY_CLASS'
  | 'TIMING_ALLOWED_BY_PRE_WINDOW'
  | 'TIMING_ALLOWED_BY_POST_WINDOW'
  | 'TIMING_ALLOWED_BY_FATE_WINDOW'
  | 'TIMING_ALLOWED_BY_COUNTER_WINDOW'
  | 'TIMING_ALLOWED_BY_RESCUE_WINDOW'
  | 'TIMING_ALLOWED_BY_AID_WINDOW'
  | 'TIMING_ALLOWED_BY_GHOST_MARKER_WINDOW'
  | 'TIMING_ALLOWED_BY_CASCADE_WINDOW'
  | 'TIMING_ALLOWED_BY_PHASE_BOUNDARY_WINDOW'
  | 'TIMING_ALLOWED_BY_PRESSURE_SPIKE_WINDOW'
  | 'TIMING_ALLOWED_BY_END_WINDOW'
  | 'TIMING_BLOCKED_BY_PRE_WINDOW'
  | 'TIMING_BLOCKED_BY_POST_WINDOW'
  | 'TIMING_BLOCKED_BY_FATE_WINDOW'
  | 'TIMING_BLOCKED_BY_COUNTER_WINDOW'
  | 'TIMING_BLOCKED_BY_RESCUE_WINDOW'
  | 'TIMING_BLOCKED_BY_AID_WINDOW'
  | 'TIMING_BLOCKED_BY_GHOST_MARKER_WINDOW'
  | 'TIMING_BLOCKED_BY_CASCADE_WINDOW'
  | 'TIMING_BLOCKED_BY_PHASE_BOUNDARY_WINDOW'
  | 'TIMING_BLOCKED_BY_PRESSURE_SPIKE_WINDOW'
  | 'TIMING_BLOCKED_BY_END_WINDOW'
  | 'TIMING_WINDOW_MATCHED_EXPLICIT_CARD'
  | 'TIMING_WINDOW_MATCHED_TIMING_ONLY'
  | 'TIMING_WINDOW_MATCHED_GENERIC_RUNTIME'
  | 'TIMING_WINDOW_NOT_PRESENT'
  | 'TIMING_CONTEXT_SUPPORTS_PRE'
  | 'TIMING_CONTEXT_SUPPORTS_POST'
  | 'TIMING_CONTEXT_SUPPORTS_FATE'
  | 'TIMING_CONTEXT_SUPPORTS_COUNTER'
  | 'TIMING_CONTEXT_SUPPORTS_RESCUE'
  | 'TIMING_CONTEXT_SUPPORTS_AID'
  | 'TIMING_CONTEXT_SUPPORTS_GHOST'
  | 'TIMING_CONTEXT_SUPPORTS_CASCADE'
  | 'TIMING_CONTEXT_SUPPORTS_PHASE'
  | 'TIMING_CONTEXT_SUPPORTS_SPIKE'
  | 'TIMING_CONTEXT_SUPPORTS_END'
  | 'TIMING_CONTEXT_LACKS_PVP_LANE'
  | 'TIMING_CONTEXT_LACKS_COOP_LANE'
  | 'TIMING_CONTEXT_LACKS_GHOST_LANE'
  | 'TIMING_CONTEXT_LACKS_SHARED_TREASURY'
  | 'TIMING_CONTEXT_LACKS_LEGEND_BASELINE'
  | 'TIMING_CONTEXT_LACKS_COUNTER_INTEL'
  | 'TIMING_CONTEXT_LACKS_ATTACK_PRESSURE'
  | 'TIMING_CONTEXT_LACKS_CASCADE_ACTIVITY'
  | 'TIMING_CONTEXT_LACKS_PHASE_WINDOW'
  | 'TIMING_CONTEXT_LACKS_SPIKE_STATE'
  | 'TIMING_CONTEXT_LACKS_END_STATE';

export interface TimingWindowDigest {
  readonly timing: TimingClass;
  readonly activeCount: number;
  readonly frozenCount: number;
  readonly explicitCardMatchCount: number;
  readonly matchedWindowIds: readonly string[];
  readonly bestMatchScore: number;
}

export interface TimingRuntimeContext {
  readonly outcomeFinalized: boolean;
  readonly integrityQuarantined: boolean;
  readonly warningQuarantined: boolean;
  readonly modeMatchesCard: boolean;
  readonly declaredModeLegal: boolean;
  readonly decayActive: boolean;
  readonly remainingMs: number;
  readonly endStateNear: boolean;
  readonly pressureSpike: boolean;
  readonly fateStress: boolean;
  readonly rescueStress: boolean;
  readonly aidContextActive: boolean;
  readonly counterContextActive: boolean;
  readonly cascadeContextActive: boolean;
  readonly phaseBoundaryActive: boolean;
  readonly ghostContextActive: boolean;
  readonly pvpLaneActive: boolean;
  readonly coopLaneActive: boolean;
  readonly ghostLaneActive: boolean;
  readonly sharedTreasuryLaneActive: boolean;
  readonly counterIntelAvailable: boolean;
  readonly extractionPressureActive: boolean;
  readonly legendBaselineAvailable: boolean;
  readonly recentMarkerForCard: boolean;
  readonly recentAnyMarker: boolean;
  readonly recentHardMarkerForCard: boolean;
  readonly activeWindowCount: number;
  readonly frozenWindowCount: number;
  readonly trustMin: number;
  readonly trustAverage: number;
  readonly roleCount: number;
  readonly activeAttackCount: number;
  readonly visibleThreatCount: number;
  readonly negativeAttackCount: number;
  readonly recentFubarDepth: number;
  readonly recentNegativeWarnings: number;
  readonly windowDigests: Readonly<Record<TimingClass, TimingWindowDigest>>;
}

export interface TimingDoctrineContext {
  readonly deckType: DeckType;
  readonly tagSupportedTimings: readonly TimingClass[];
  readonly deckSupportedTimings: readonly TimingClass[];
  readonly modeSupportedTimings: readonly TimingClass[];
  readonly declaredTimings: readonly TimingClass[];
  readonly preferredTimings: readonly TimingClass[];
  readonly tagTimingHits: readonly string[];
}

export interface TimingCheckResult {
  readonly timing: TimingClass;
  readonly allowed: boolean;
  readonly reasons: readonly TimingReasonCode[];
  readonly digest: TimingWindowDigest;
  readonly doctrineWeight: number;
  readonly summary: string;
}

export interface CardTimingAudit {
  readonly cardInstanceId: string;
  readonly cardDefinitionId: string;
  readonly mode: RunStateSnapshot['mode'];
  readonly tick: number;
  readonly allowed: boolean;
  readonly legalTimings: readonly TimingClass[];
  readonly preferredTiming: TimingClass | null;
  readonly checks: readonly TimingCheckResult[];
  readonly context: TimingRuntimeContext;
  readonly doctrine: TimingDoctrineContext;
  readonly summary: string;
}

/* ──────────────────────────────────────────────────────────────────────────────
 * Validator
 * ──────────────────────────────────────────────────────────────────────────── */

export class CardTimingValidator {
  private readonly registry = new CardRegistry();

  public isLegal(snapshot: RunStateSnapshot, card: CardInstance): boolean {
    return this.evaluate(snapshot, card).allowed;
  }

  public legalTimings(
    snapshot: RunStateSnapshot,
    card: CardInstance,
  ): TimingClass[] {
    return [...this.evaluate(snapshot, card).legalTimings];
  }

  public preferredTiming(
    snapshot: RunStateSnapshot,
    card: CardInstance,
  ): TimingClass | null {
    return this.evaluate(snapshot, card).preferredTiming;
  }

  public explain(
    snapshot: RunStateSnapshot,
    card: CardInstance,
  ): string {
    return this.evaluate(snapshot, card).summary;
  }

  public detail(
    snapshot: RunStateSnapshot,
    card: CardInstance,
    timing: TimingClass,
  ): TimingCheckResult {
    const audit = this.evaluate(snapshot, card);
    return (
      audit.checks.find((check) => check.timing === timing) ??
      this.buildMissingTimingResult(snapshot, card, timing, audit.context, audit.doctrine)
    );
  }

  public evaluate(
    snapshot: RunStateSnapshot,
    card: CardInstance,
  ): CardTimingAudit {
    const runtimeContext = this.buildRuntimeContext(snapshot, card);
    const doctrineContext = this.buildDoctrineContext(snapshot, card);
    const declaredTimings = this.normalizeTimingList(card.timingClass);

    const checks: TimingCheckResult[] = declaredTimings.map((timing) =>
      this.evaluateTiming(snapshot, card, timing, runtimeContext, doctrineContext),
    );

    const legalTimings = checks
      .filter((check) => check.allowed)
      .map((check) => check.timing);

    const preferredTiming = this.pickPreferredTiming(
      legalTimings,
      checks,
      doctrineContext,
    );

    const allowed = legalTimings.length > 0;
    const summary = this.buildAuditSummary(
      snapshot,
      card,
      allowed,
      legalTimings,
      preferredTiming,
      checks,
      runtimeContext,
    );

    return {
      cardInstanceId: card.instanceId,
      cardDefinitionId: card.definitionId,
      mode: snapshot.mode,
      tick: snapshot.tick,
      allowed,
      legalTimings,
      preferredTiming,
      checks,
      context: runtimeContext,
      doctrine: doctrineContext,
      summary,
    };
  }

  /* ────────────────────────────────────────────────────────────────────────── */

  private evaluateTiming(
    snapshot: RunStateSnapshot,
    card: CardInstance,
    timing: TimingClass,
    runtime: TimingRuntimeContext,
    doctrine: TimingDoctrineContext,
  ): TimingCheckResult {
    const reasons: TimingReasonCode[] = [];
    const digest = runtime.windowDigests[timing] ?? this.emptyWindowDigest(timing);

    if (!this.hasDeclaredTiming(card, timing)) {
      reasons.push('TIMING_NOT_DECLARED_ON_CARD');
      return this.finalizeTimingResult(timing, false, reasons, digest, doctrine, runtime);
    }

    if (runtime.outcomeFinalized) {
      reasons.push('TIMING_BLOCKED_BY_OUTCOME_FINALIZED');
      return this.finalizeTimingResult(timing, false, reasons, digest, doctrine, runtime);
    }

    if (runtime.integrityQuarantined) {
      reasons.push('TIMING_BLOCKED_BY_INTEGRITY_QUARANTINE');
      return this.finalizeTimingResult(timing, false, reasons, digest, doctrine, runtime);
    }

    if (runtime.warningQuarantined) {
      reasons.push('TIMING_BLOCKED_BY_WARNING_QUARANTINE');
      return this.finalizeTimingResult(timing, false, reasons, digest, doctrine, runtime);
    }

    if (!runtime.modeMatchesCard) {
      reasons.push('TIMING_BLOCKED_BY_CARD_MODE_MISMATCH');
      return this.finalizeTimingResult(timing, false, reasons, digest, doctrine, runtime);
    }

    if (!runtime.declaredModeLegal) {
      reasons.push('TIMING_BLOCKED_BY_CARD_DECLARATIVE_MODE');
      return this.finalizeTimingResult(timing, false, reasons, digest, doctrine, runtime);
    }

    if (!runtime.decayActive) {
      reasons.push('TIMING_BLOCKED_BY_CARD_DECAY_EXPIRED');
      return this.finalizeTimingResult(timing, false, reasons, digest, doctrine, runtime);
    }

    if (!this.isTimingSupportedByModeDoctrine(snapshot.mode, timing)) {
      reasons.push('TIMING_BLOCKED_BY_MODE_DOCTRINE');
      return this.finalizeTimingResult(timing, false, reasons, digest, doctrine, runtime);
    }

    if (!this.isTimingSupportedByDeckDoctrine(card.card.deckType, timing)) {
      reasons.push('TIMING_BLOCKED_BY_DECK_DOCTRINE');
      return this.finalizeTimingResult(timing, false, reasons, digest, doctrine, runtime);
    }

    if (this.isTimingSupportedByTagDoctrine(card.tags, timing)) {
      reasons.push('TIMING_SUPPORTED_BY_TAG_DOCTRINE');
    }

    const allowed = this.applyTimingSpecificDoctrine(
      snapshot,
      card,
      timing,
      runtime,
      reasons,
    );

    return this.finalizeTimingResult(timing, allowed, reasons, digest, doctrine, runtime);
  }

  private applyTimingSpecificDoctrine(
    snapshot: RunStateSnapshot,
    card: CardInstance,
    timing: TimingClass,
    runtime: TimingRuntimeContext,
    reasons: TimingReasonCode[],
  ): boolean {
    switch (timing) {
      case 'ANY':
        reasons.push('TIMING_ALLOWED_BY_ANY_CLASS');
        return true;

      case 'PRE':
        return this.checkPreWindow(snapshot, card, runtime, reasons);

      case 'POST':
        return this.checkPostWindow(snapshot, card, runtime, reasons);

      case 'FATE':
        return this.checkFateWindow(snapshot, card, runtime, reasons);

      case 'CTR':
        return this.checkCounterWindow(snapshot, card, runtime, reasons);

      case 'RES':
        return this.checkRescueWindow(snapshot, card, runtime, reasons);

      case 'AID':
        return this.checkAidWindow(snapshot, card, runtime, reasons);

      case 'GBM':
        return this.checkGhostBaselineMarkerWindow(snapshot, card, runtime, reasons);

      case 'CAS':
        return this.checkCascadeWindow(snapshot, card, runtime, reasons);

      case 'PHZ':
        return this.checkPhaseBoundaryWindow(snapshot, card, runtime, reasons);

      case 'PSK':
        return this.checkPressureSpikeWindow(snapshot, card, runtime, reasons);

      case 'END':
        return this.checkEndWindow(snapshot, card, runtime, reasons);

      default:
        reasons.push('TIMING_BLOCKED_BY_RUNTIME_RULE');
        return false;
    }
  }

  /* ────────────────────────────────────────────────────────────────────────── */

  private checkPreWindow(
    snapshot: RunStateSnapshot,
    _card: CardInstance,
    runtime: TimingRuntimeContext,
    reasons: TimingReasonCode[],
  ): boolean {
    const digest = runtime.windowDigests.PRE;

    if (digest.explicitCardMatchCount > 0) {
      reasons.push('TIMING_WINDOW_MATCHED_EXPLICIT_CARD');
      reasons.push('TIMING_ALLOWED_BY_PRE_WINDOW');
      reasons.push('TIMING_CONTEXT_SUPPORTS_PRE');
      return true;
    }

    if (digest.activeCount > 0) {
      reasons.push('TIMING_WINDOW_MATCHED_TIMING_ONLY');
      reasons.push('TIMING_ALLOWED_BY_PRE_WINDOW');
      reasons.push('TIMING_CONTEXT_SUPPORTS_PRE');
      return true;
    }

    if (snapshot.phase === 'FOUNDATION') {
      reasons.push('TIMING_ALLOWED_BY_PRE_WINDOW');
      reasons.push('TIMING_CONTEXT_SUPPORTS_PRE');
      return true;
    }

    if (runtime.phaseBoundaryActive) {
      reasons.push('TIMING_ALLOWED_BY_PRE_WINDOW');
      reasons.push('TIMING_CONTEXT_SUPPORTS_PHASE');
      return true;
    }

    if (snapshot.modeState.holdEnabled && snapshot.timers.holdCharges > 0) {
      reasons.push('TIMING_WINDOW_MATCHED_GENERIC_RUNTIME');
      reasons.push('TIMING_ALLOWED_BY_PRE_WINDOW');
      reasons.push('TIMING_CONTEXT_SUPPORTS_PRE');
      return true;
    }

    reasons.push('TIMING_WINDOW_NOT_PRESENT');
    reasons.push('TIMING_BLOCKED_BY_PRE_WINDOW');
    return false;
  }

  private checkPostWindow(
    snapshot: RunStateSnapshot,
    _card: CardInstance,
    runtime: TimingRuntimeContext,
    reasons: TimingReasonCode[],
  ): boolean {
    const digest = runtime.windowDigests.POST;

    if (digest.explicitCardMatchCount > 0) {
      reasons.push('TIMING_WINDOW_MATCHED_EXPLICIT_CARD');
      reasons.push('TIMING_ALLOWED_BY_POST_WINDOW');
      reasons.push('TIMING_CONTEXT_SUPPORTS_POST');
      return true;
    }

    if (digest.activeCount > 0) {
      reasons.push('TIMING_WINDOW_MATCHED_TIMING_ONLY');
      reasons.push('TIMING_ALLOWED_BY_POST_WINDOW');
      reasons.push('TIMING_CONTEXT_SUPPORTS_POST');
      return true;
    }

    if (
      snapshot.tick > 0 &&
      (
        snapshot.cards.lastPlayed.length > 0 ||
        snapshot.telemetry.decisions.length > 0 ||
        snapshot.phase === 'ESCALATION' ||
        snapshot.phase === 'SOVEREIGNTY'
      )
    ) {
      reasons.push('TIMING_ALLOWED_BY_POST_WINDOW');
      reasons.push('TIMING_CONTEXT_SUPPORTS_POST');
      return true;
    }

    reasons.push('TIMING_WINDOW_NOT_PRESENT');
    reasons.push('TIMING_BLOCKED_BY_POST_WINDOW');
    return false;
  }

  private checkFateWindow(
    snapshot: RunStateSnapshot,
    _card: CardInstance,
    runtime: TimingRuntimeContext,
    reasons: TimingReasonCode[],
  ): boolean {
    const digest = runtime.windowDigests.FATE;

    if (digest.explicitCardMatchCount > 0) {
      reasons.push('TIMING_WINDOW_MATCHED_EXPLICIT_CARD');
      reasons.push('TIMING_ALLOWED_BY_FATE_WINDOW');
      reasons.push('TIMING_CONTEXT_SUPPORTS_FATE');
      return true;
    }

    if (digest.activeCount > 0) {
      reasons.push('TIMING_WINDOW_MATCHED_TIMING_ONLY');
      reasons.push('TIMING_ALLOWED_BY_FATE_WINDOW');
      reasons.push('TIMING_CONTEXT_SUPPORTS_FATE');
      return true;
    }

    if (runtime.fateStress) {
      reasons.push('TIMING_WINDOW_MATCHED_GENERIC_RUNTIME');
      reasons.push('TIMING_ALLOWED_BY_FATE_WINDOW');
      reasons.push('TIMING_CONTEXT_SUPPORTS_FATE');
      return true;
    }

    if (snapshot.tension.visibleThreats.length > 0 && snapshot.tension.score >= ELEVATED_TENSION_SCORE) {
      reasons.push('TIMING_ALLOWED_BY_FATE_WINDOW');
      reasons.push('TIMING_CONTEXT_SUPPORTS_FATE');
      return true;
    }

    reasons.push('TIMING_WINDOW_NOT_PRESENT');
    reasons.push('TIMING_BLOCKED_BY_FATE_WINDOW');
    return false;
  }

  private checkCounterWindow(
    snapshot: RunStateSnapshot,
    card: CardInstance,
    runtime: TimingRuntimeContext,
    reasons: TimingReasonCode[],
  ): boolean {
    if (snapshot.mode !== 'pvp') {
      reasons.push('TIMING_CONTEXT_LACKS_PVP_LANE');
      reasons.push('TIMING_BLOCKED_BY_COUNTER_WINDOW');
      return false;
    }

    const digest = runtime.windowDigests.CTR;

    if (digest.explicitCardMatchCount > 0) {
      reasons.push('TIMING_WINDOW_MATCHED_EXPLICIT_CARD');
      reasons.push('TIMING_ALLOWED_BY_COUNTER_WINDOW');
      reasons.push('TIMING_CONTEXT_SUPPORTS_COUNTER');
      return true;
    }

    if (digest.activeCount > 0) {
      reasons.push('TIMING_WINDOW_MATCHED_TIMING_ONLY');
      reasons.push('TIMING_ALLOWED_BY_COUNTER_WINDOW');
      reasons.push('TIMING_CONTEXT_SUPPORTS_COUNTER');
      return true;
    }

    if (runtime.counterContextActive) {
      reasons.push('TIMING_WINDOW_MATCHED_GENERIC_RUNTIME');
      reasons.push('TIMING_ALLOWED_BY_COUNTER_WINDOW');
      reasons.push('TIMING_CONTEXT_SUPPORTS_COUNTER');
      return true;
    }

    if (
      card.card.deckType === 'COUNTER' &&
      runtime.counterIntelAvailable &&
      runtime.extractionPressureActive
    ) {
      reasons.push('TIMING_ALLOWED_BY_COUNTER_WINDOW');
      reasons.push('TIMING_CONTEXT_SUPPORTS_COUNTER');
      return true;
    }

    if (!runtime.counterIntelAvailable) {
      reasons.push('TIMING_CONTEXT_LACKS_COUNTER_INTEL');
    }

    if (!runtime.extractionPressureActive) {
      reasons.push('TIMING_CONTEXT_LACKS_ATTACK_PRESSURE');
    }

    reasons.push('TIMING_WINDOW_NOT_PRESENT');
    reasons.push('TIMING_BLOCKED_BY_COUNTER_WINDOW');
    return false;
  }

  private checkRescueWindow(
    snapshot: RunStateSnapshot,
    _card: CardInstance,
    runtime: TimingRuntimeContext,
    reasons: TimingReasonCode[],
  ): boolean {
    if (snapshot.mode !== 'coop') {
      reasons.push('TIMING_CONTEXT_LACKS_COOP_LANE');
      reasons.push('TIMING_BLOCKED_BY_RESCUE_WINDOW');
      return false;
    }

    const digest = runtime.windowDigests.RES;

    if (digest.explicitCardMatchCount > 0) {
      reasons.push('TIMING_WINDOW_MATCHED_EXPLICIT_CARD');
      reasons.push('TIMING_ALLOWED_BY_RESCUE_WINDOW');
      reasons.push('TIMING_CONTEXT_SUPPORTS_RESCUE');
      return true;
    }

    if (digest.activeCount > 0) {
      reasons.push('TIMING_WINDOW_MATCHED_TIMING_ONLY');
      reasons.push('TIMING_ALLOWED_BY_RESCUE_WINDOW');
      reasons.push('TIMING_CONTEXT_SUPPORTS_RESCUE');
      return true;
    }

    if (runtime.rescueStress) {
      reasons.push('TIMING_WINDOW_MATCHED_GENERIC_RUNTIME');
      reasons.push('TIMING_ALLOWED_BY_RESCUE_WINDOW');
      reasons.push('TIMING_CONTEXT_SUPPORTS_RESCUE');
      return true;
    }

    reasons.push('TIMING_WINDOW_NOT_PRESENT');
    reasons.push('TIMING_BLOCKED_BY_RESCUE_WINDOW');
    return false;
  }

  private checkAidWindow(
    snapshot: RunStateSnapshot,
    _card: CardInstance,
    runtime: TimingRuntimeContext,
    reasons: TimingReasonCode[],
  ): boolean {
    if (snapshot.mode !== 'coop') {
      reasons.push('TIMING_CONTEXT_LACKS_COOP_LANE');
      reasons.push('TIMING_BLOCKED_BY_AID_WINDOW');
      return false;
    }

    const digest = runtime.windowDigests.AID;

    if (digest.explicitCardMatchCount > 0) {
      reasons.push('TIMING_WINDOW_MATCHED_EXPLICIT_CARD');
      reasons.push('TIMING_ALLOWED_BY_AID_WINDOW');
      reasons.push('TIMING_CONTEXT_SUPPORTS_AID');
      return true;
    }

    if (digest.activeCount > 0) {
      reasons.push('TIMING_WINDOW_MATCHED_TIMING_ONLY');
      reasons.push('TIMING_ALLOWED_BY_AID_WINDOW');
      reasons.push('TIMING_CONTEXT_SUPPORTS_AID');
      return true;
    }

    if (runtime.aidContextActive) {
      reasons.push('TIMING_WINDOW_MATCHED_GENERIC_RUNTIME');
      reasons.push('TIMING_ALLOWED_BY_AID_WINDOW');
      reasons.push('TIMING_CONTEXT_SUPPORTS_AID');
      return true;
    }

    if (!runtime.sharedTreasuryLaneActive) {
      reasons.push('TIMING_CONTEXT_LACKS_SHARED_TREASURY');
    }

    reasons.push('TIMING_WINDOW_NOT_PRESENT');
    reasons.push('TIMING_BLOCKED_BY_AID_WINDOW');
    return false;
  }

  private checkGhostBaselineMarkerWindow(
    snapshot: RunStateSnapshot,
    _card: CardInstance,
    runtime: TimingRuntimeContext,
    reasons: TimingReasonCode[],
  ): boolean {
    if (snapshot.mode !== 'ghost') {
      reasons.push('TIMING_CONTEXT_LACKS_GHOST_LANE');
      reasons.push('TIMING_BLOCKED_BY_GHOST_MARKER_WINDOW');
      return false;
    }

    const digest = runtime.windowDigests.GBM;

    if (digest.explicitCardMatchCount > 0) {
      reasons.push('TIMING_WINDOW_MATCHED_EXPLICIT_CARD');
      reasons.push('TIMING_ALLOWED_BY_GHOST_MARKER_WINDOW');
      reasons.push('TIMING_CONTEXT_SUPPORTS_GHOST');
      return true;
    }

    if (runtime.recentHardMarkerForCard) {
      reasons.push('TIMING_ALLOWED_BY_GHOST_MARKER_WINDOW');
      reasons.push('TIMING_CONTEXT_SUPPORTS_GHOST');
      return true;
    }

    if (digest.activeCount > 0) {
      reasons.push('TIMING_WINDOW_MATCHED_TIMING_ONLY');
      reasons.push('TIMING_ALLOWED_BY_GHOST_MARKER_WINDOW');
      reasons.push('TIMING_CONTEXT_SUPPORTS_GHOST');
      return true;
    }

    if (runtime.recentMarkerForCard || runtime.recentAnyMarker) {
      reasons.push('TIMING_WINDOW_MATCHED_GENERIC_RUNTIME');
      reasons.push('TIMING_ALLOWED_BY_GHOST_MARKER_WINDOW');
      reasons.push('TIMING_CONTEXT_SUPPORTS_GHOST');
      return true;
    }

    if (!runtime.legendBaselineAvailable) {
      reasons.push('TIMING_CONTEXT_LACKS_LEGEND_BASELINE');
    }

    reasons.push('TIMING_WINDOW_NOT_PRESENT');
    reasons.push('TIMING_BLOCKED_BY_GHOST_MARKER_WINDOW');
    return false;
  }

  private checkCascadeWindow(
    snapshot: RunStateSnapshot,
    _card: CardInstance,
    runtime: TimingRuntimeContext,
    reasons: TimingReasonCode[],
  ): boolean {
    const digest = runtime.windowDigests.CAS;

    if (digest.explicitCardMatchCount > 0) {
      reasons.push('TIMING_WINDOW_MATCHED_EXPLICIT_CARD');
      reasons.push('TIMING_ALLOWED_BY_CASCADE_WINDOW');
      reasons.push('TIMING_CONTEXT_SUPPORTS_CASCADE');
      return true;
    }

    if (digest.activeCount > 0) {
      reasons.push('TIMING_WINDOW_MATCHED_TIMING_ONLY');
      reasons.push('TIMING_ALLOWED_BY_CASCADE_WINDOW');
      reasons.push('TIMING_CONTEXT_SUPPORTS_CASCADE');
      return true;
    }

    if (runtime.cascadeContextActive) {
      reasons.push('TIMING_WINDOW_MATCHED_GENERIC_RUNTIME');
      reasons.push('TIMING_ALLOWED_BY_CASCADE_WINDOW');
      reasons.push('TIMING_CONTEXT_SUPPORTS_CASCADE');
      return true;
    }

    if (
      snapshot.cascade.lastResolvedTick !== null &&
      snapshot.tick - snapshot.cascade.lastResolvedTick <= CASCADE_RECENCY_TICKS
    ) {
      reasons.push('TIMING_ALLOWED_BY_CASCADE_WINDOW');
      reasons.push('TIMING_CONTEXT_SUPPORTS_CASCADE');
      return true;
    }

    reasons.push('TIMING_CONTEXT_LACKS_CASCADE_ACTIVITY');
    reasons.push('TIMING_WINDOW_NOT_PRESENT');
    reasons.push('TIMING_BLOCKED_BY_CASCADE_WINDOW');
    return false;
  }

  private checkPhaseBoundaryWindow(
    snapshot: RunStateSnapshot,
    _card: CardInstance,
    runtime: TimingRuntimeContext,
    reasons: TimingReasonCode[],
  ): boolean {
    if (snapshot.mode !== 'solo') {
      reasons.push('TIMING_BLOCKED_BY_PHASE_BOUNDARY_WINDOW');
      return false;
    }

    const digest = runtime.windowDigests.PHZ;

    if (digest.explicitCardMatchCount > 0) {
      reasons.push('TIMING_WINDOW_MATCHED_EXPLICIT_CARD');
      reasons.push('TIMING_ALLOWED_BY_PHASE_BOUNDARY_WINDOW');
      reasons.push('TIMING_CONTEXT_SUPPORTS_PHASE');
      return true;
    }

    if (digest.activeCount > 0) {
      reasons.push('TIMING_WINDOW_MATCHED_TIMING_ONLY');
      reasons.push('TIMING_ALLOWED_BY_PHASE_BOUNDARY_WINDOW');
      reasons.push('TIMING_CONTEXT_SUPPORTS_PHASE');
      return true;
    }

    if (runtime.phaseBoundaryActive) {
      reasons.push('TIMING_WINDOW_MATCHED_GENERIC_RUNTIME');
      reasons.push('TIMING_ALLOWED_BY_PHASE_BOUNDARY_WINDOW');
      reasons.push('TIMING_CONTEXT_SUPPORTS_PHASE');
      return true;
    }

    reasons.push('TIMING_CONTEXT_LACKS_PHASE_WINDOW');
    reasons.push('TIMING_WINDOW_NOT_PRESENT');
    reasons.push('TIMING_BLOCKED_BY_PHASE_BOUNDARY_WINDOW');
    return false;
  }

  private checkPressureSpikeWindow(
    snapshot: RunStateSnapshot,
    _card: CardInstance,
    runtime: TimingRuntimeContext,
    reasons: TimingReasonCode[],
  ): boolean {
    const digest = runtime.windowDigests.PSK;

    if (digest.explicitCardMatchCount > 0) {
      reasons.push('TIMING_WINDOW_MATCHED_EXPLICIT_CARD');
      reasons.push('TIMING_ALLOWED_BY_PRESSURE_SPIKE_WINDOW');
      reasons.push('TIMING_CONTEXT_SUPPORTS_SPIKE');
      return true;
    }

    if (digest.activeCount > 0) {
      reasons.push('TIMING_WINDOW_MATCHED_TIMING_ONLY');
      reasons.push('TIMING_ALLOWED_BY_PRESSURE_SPIKE_WINDOW');
      reasons.push('TIMING_CONTEXT_SUPPORTS_SPIKE');
      return true;
    }

    if (runtime.pressureSpike) {
      reasons.push('TIMING_WINDOW_MATCHED_GENERIC_RUNTIME');
      reasons.push('TIMING_ALLOWED_BY_PRESSURE_SPIKE_WINDOW');
      reasons.push('TIMING_CONTEXT_SUPPORTS_SPIKE');
      return true;
    }

    if (
      snapshot.pressure.score >= HIGH_PRESSURE_SCORE ||
      snapshot.tension.score >= HIGH_TENSION_SCORE ||
      snapshot.economy.haterHeat >= HEAT_HIGH
    ) {
      reasons.push('TIMING_ALLOWED_BY_PRESSURE_SPIKE_WINDOW');
      reasons.push('TIMING_CONTEXT_SUPPORTS_SPIKE');
      return true;
    }

    reasons.push('TIMING_CONTEXT_LACKS_SPIKE_STATE');
    reasons.push('TIMING_WINDOW_NOT_PRESENT');
    reasons.push('TIMING_BLOCKED_BY_PRESSURE_SPIKE_WINDOW');
    return false;
  }

  private checkEndWindow(
    snapshot: RunStateSnapshot,
    _card: CardInstance,
    runtime: TimingRuntimeContext,
    reasons: TimingReasonCode[],
  ): boolean {
    const digest = runtime.windowDigests.END;

    if (digest.explicitCardMatchCount > 0) {
      reasons.push('TIMING_WINDOW_MATCHED_EXPLICIT_CARD');
      reasons.push('TIMING_ALLOWED_BY_END_WINDOW');
      reasons.push('TIMING_CONTEXT_SUPPORTS_END');
      return true;
    }

    if (digest.activeCount > 0) {
      reasons.push('TIMING_WINDOW_MATCHED_TIMING_ONLY');
      reasons.push('TIMING_ALLOWED_BY_END_WINDOW');
      reasons.push('TIMING_CONTEXT_SUPPORTS_END');
      return true;
    }

    if (runtime.endStateNear) {
      reasons.push('TIMING_WINDOW_MATCHED_GENERIC_RUNTIME');
      reasons.push('TIMING_ALLOWED_BY_END_WINDOW');
      reasons.push('TIMING_CONTEXT_SUPPORTS_END');
      return true;
    }

    if (
      snapshot.telemetry.outcomeReasonCode === 'SEASON_BUDGET_EXHAUSTED' ||
      snapshot.telemetry.outcomeReasonCode === 'TARGET_REACHED'
    ) {
      reasons.push('TIMING_ALLOWED_BY_END_WINDOW');
      reasons.push('TIMING_CONTEXT_SUPPORTS_END');
      return true;
    }

    reasons.push('TIMING_CONTEXT_LACKS_END_STATE');
    reasons.push('TIMING_WINDOW_NOT_PRESENT');
    reasons.push('TIMING_BLOCKED_BY_END_WINDOW');
    return false;
  }

  /* ────────────────────────────────────────────────────────────────────────── */

  private buildRuntimeContext(
    snapshot: RunStateSnapshot,
    card: CardInstance,
  ): TimingRuntimeContext {
    const remainingMs =
      snapshot.timers.seasonBudgetMs +
      snapshot.timers.extensionBudgetMs -
      snapshot.timers.elapsedMs;

    const trustValues = Object.values(snapshot.modeState.trustScores);
    const trustMin = trustValues.length > 0 ? Math.min(...trustValues) : 100;
    const trustAverage =
      trustValues.length > 0
        ? trustValues.reduce((sum, value) => sum + value, 0) / trustValues.length
        : 100;

    const activeAttackCount = snapshot.battle.pendingAttacks.length;
    const negativeAttackCount = snapshot.battle.pendingAttacks.filter((attack) =>
      (NEGATIVE_ATTACK_CATEGORIES as readonly string[]).includes(attack.category),
    ).length;

    const recentFubarDepth = Math.max(
      this.detectRecentDeckTypeDepth(snapshot.cards.lastPlayed, 'FUBAR', 8),
      this.detectRecentDeckTypeDepth(snapshot.cards.exhaust, 'FUBAR', 8),
      this.detectRecentDeckTypeDepth(snapshot.cards.drawHistory, 'FUBAR', 10),
    );

    const recentNegativeWarnings = this.countWarningHints(
      snapshot.telemetry.warnings,
      FATE_WARNING_HINTS,
    );

    const pvpLaneActive = snapshot.mode === 'pvp';
    const coopLaneActive = snapshot.mode === 'coop';
    const ghostLaneActive = snapshot.mode === 'ghost';
    const sharedTreasuryLaneActive =
      coopLaneActive && snapshot.modeState.sharedTreasury;
    const counterIntelAvailable = snapshot.modeState.counterIntelTier > 0;
    const extractionPressureActive =
      activeAttackCount > 0 || snapshot.modeState.extractionActionsRemaining > 0;
    const legendBaselineAvailable =
      ghostLaneActive &&
      snapshot.modeState.legendMarkersEnabled &&
      snapshot.modeState.ghostBaselineRunId !== null;

    const recentMarkerForCard = this.hasRecentMarkerForCard(
      snapshot,
      card.definitionId,
      GHOST_MARKER_WINDOW_TICKS,
    );
    const recentAnyMarker = this.hasRecentAnyMarker(
      snapshot,
      GHOST_MARKER_WINDOW_TICKS,
    );
    const recentHardMarkerForCard = this.hasRecentMarkerForCard(
      snapshot,
      card.definitionId,
      GHOST_MARKER_HARD_WINDOW_TICKS,
    );

    const phaseBoundaryActive =
      snapshot.mode === 'solo' &&
      snapshot.modeState.phaseBoundaryWindowsRemaining > 0;

    const counterContextActive =
      pvpLaneActive &&
      (
        this.hasExplicitTimingWindow(snapshot, card, 'CTR') ||
        this.hasActiveTimingWindow(snapshot, 'CTR') ||
        counterIntelAvailable ||
        this.hasCounterableAttack(snapshot)
      );

    const rescueStress =
      coopLaneActive &&
      (
        this.hasExplicitTimingWindow(snapshot, card, 'RES') ||
        this.hasActiveTimingWindow(snapshot, 'RES') ||
        snapshot.modeState.bleedMode ||
        trustMin < RESCUE_TRUST_THRESHOLD ||
        snapshot.modeState.sharedTreasuryBalance <= TREASURY_STRESS_THRESHOLD ||
        snapshot.cascade.activeChains.length > 0
      );

    const aidContextActive =
      coopLaneActive &&
      (
        this.hasExplicitTimingWindow(snapshot, card, 'AID') ||
        this.hasActiveTimingWindow(snapshot, 'AID') ||
        snapshot.modeState.sharedTreasury ||
        Object.keys(snapshot.modeState.roleAssignments).length > 0 ||
        trustAverage < STABLE_TRUST_THRESHOLD
      );

    const fateStress =
      recentFubarDepth > 0 ||
      recentNegativeWarnings > 0 ||
      snapshot.tension.visibleThreats.length > 0 ||
      negativeAttackCount > 0 ||
      snapshot.pressure.score >= HIGH_PRESSURE_SCORE;

    const pressureSpike =
      this.rank(snapshot.pressure.tier) > this.rank(snapshot.pressure.previousTier) ||
      this.bandRank(snapshot.pressure.band) > this.bandRank(snapshot.pressure.previousBand) ||
      snapshot.pressure.score >= CRITICAL_PRESSURE_SCORE ||
      snapshot.tension.maxPulseTriggered ||
      snapshot.economy.haterHeat >= HEAT_CRITICAL;

    const cascadeContextActive =
      snapshot.cascade.activeChains.length > 0 ||
      this.hasActiveTimingWindow(snapshot, 'CAS') ||
      this.hasExplicitTimingWindow(snapshot, card, 'CAS');

    const ghostContextActive =
      ghostLaneActive &&
      legendBaselineAvailable &&
      (
        recentMarkerForCard ||
        recentAnyMarker ||
        this.hasActiveTimingWindow(snapshot, 'GBM') ||
        this.hasExplicitTimingWindow(snapshot, card, 'GBM')
      );

    const outcomeFinalized = snapshot.outcome !== null;
    const integrityQuarantined = snapshot.sovereignty.integrityStatus === 'QUARANTINED';
    const warningQuarantined = this.isWarningQuarantined(snapshot.telemetry.warnings);
    const modeMatchesCard = card.overlayAppliedForMode === snapshot.mode;
    const declaredModeLegal = card.card.modeLegal.includes(snapshot.mode);
    const decayActive = card.decayTicksRemaining === null || card.decayTicksRemaining > 0;
    const endStateNear =
      remainingMs <= END_WINDOW_MS ||
      this.estimateTicksRemaining(snapshot, remainingMs) <= END_WINDOW_TICKS_FALLBACK;

    const windowDigests = this.buildWindowDigests(snapshot, card);

    return {
      outcomeFinalized,
      integrityQuarantined,
      warningQuarantined,
      modeMatchesCard,
      declaredModeLegal,
      decayActive,
      remainingMs,
      endStateNear,
      pressureSpike,
      fateStress,
      rescueStress,
      aidContextActive,
      counterContextActive,
      cascadeContextActive,
      phaseBoundaryActive,
      ghostContextActive,
      pvpLaneActive,
      coopLaneActive,
      ghostLaneActive,
      sharedTreasuryLaneActive,
      counterIntelAvailable,
      extractionPressureActive,
      legendBaselineAvailable,
      recentMarkerForCard,
      recentAnyMarker,
      recentHardMarkerForCard,
      activeWindowCount: Object.keys(snapshot.timers.activeDecisionWindows).length,
      frozenWindowCount: snapshot.timers.frozenWindowIds.length,
      trustMin,
      trustAverage,
      roleCount: Object.keys(snapshot.modeState.roleAssignments).length,
      activeAttackCount,
      visibleThreatCount: snapshot.tension.visibleThreats.length,
      negativeAttackCount,
      recentFubarDepth,
      recentNegativeWarnings,
      windowDigests,
    };
  }

  private buildDoctrineContext(
    snapshot: RunStateSnapshot,
    card: CardInstance,
  ): TimingDoctrineContext {
    const tagTimingHits = this.collectTagTimingHits(card.tags);
    const tagSupportedTimings = this.collectTagSupportedTimings(card.tags);
    const deckSupportedTimings = this.normalizeTimingList(
      DECK_TIMING_DOCTRINE[card.card.deckType] ?? [],
    );
    const modeSupportedTimings = this.normalizeTimingList(
      MODE_TIMING_DOCTRINE[snapshot.mode] ?? [],
    );
    const declaredTimings = this.normalizeTimingList(card.timingClass);
    const preferredTimings = this.computePreferredTimings(
      card.card.deckType,
      declaredTimings,
      tagSupportedTimings,
      snapshot.mode,
    );

    return {
      deckType: card.card.deckType,
      tagSupportedTimings,
      deckSupportedTimings,
      modeSupportedTimings,
      declaredTimings,
      preferredTimings,
      tagTimingHits,
    };
  }

  private buildWindowDigests(
    snapshot: RunStateSnapshot,
    card: CardInstance,
  ): Readonly<Record<TimingClass, TimingWindowDigest>> {
    const digests = {} as Record<TimingClass, TimingWindowDigest>;

    for (const timing of TIMING_ORDER) {
      const matchingWindows = this.matchingWindowsForTiming(snapshot, card, timing);
      const explicitMatches = matchingWindows.filter((window) =>
        this.isExplicitCardWindowMatch(window, card),
      );
      const frozenCount = matchingWindows.filter((window) => window.frozen).length;
      const bestMatchScore = matchingWindows.reduce(
        (best, window) => Math.max(best, this.scoreWindowMatch(window, card, timing)),
        0,
      );

      digests[timing] = {
        timing,
        activeCount: matchingWindows.length,
        frozenCount,
        explicitCardMatchCount: explicitMatches.length,
        matchedWindowIds: Object.freeze(matchingWindows.map((window) => window.id)),
        bestMatchScore,
      };
    }

    return digests;
  }

  /* ────────────────────────────────────────────────────────────────────────── */

  private finalizeTimingResult(
    timing: TimingClass,
    allowed: boolean,
    reasons: readonly TimingReasonCode[],
    digest: TimingWindowDigest,
    doctrine: TimingDoctrineContext,
    runtime: TimingRuntimeContext,
  ): TimingCheckResult {
    const doctrineWeight = this.computeDoctrineWeight(
      timing,
      allowed,
      digest,
      doctrine,
      runtime,
    );

    return {
      timing,
      allowed,
      reasons: Object.freeze(this.uniqueReasons(reasons)),
      digest,
      doctrineWeight,
      summary: this.buildTimingSummary(timing, allowed, reasons, digest, doctrineWeight),
    };
  }

  private buildMissingTimingResult(
    _snapshot: RunStateSnapshot,
    _card: CardInstance,
    timing: TimingClass,
    runtime: TimingRuntimeContext,
    doctrine: TimingDoctrineContext,
  ): TimingCheckResult {
    return this.finalizeTimingResult(
      timing,
      false,
      ['TIMING_NOT_DECLARED_ON_CARD'],
      runtime.windowDigests[timing] ?? this.emptyWindowDigest(timing),
      doctrine,
      runtime,
    );
  }

  private computeDoctrineWeight(
    timing: TimingClass,
    allowed: boolean,
    digest: TimingWindowDigest,
    doctrine: TimingDoctrineContext,
    runtime: TimingRuntimeContext,
  ): number {
    let score = 0;

    if (allowed) {
      score += 20;
    }

    if (doctrine.preferredTimings.includes(timing)) {
      score += 14;
    }

    if (doctrine.tagSupportedTimings.includes(timing)) {
      score += 10;
    }

    if (doctrine.deckSupportedTimings.includes(timing)) {
      score += 8;
    }

    if (digest.explicitCardMatchCount > 0) {
      score += 16;
    } else if (digest.activeCount > 0) {
      score += 8;
    }

    if (digest.frozenCount > 0) {
      score += 2;
    }

    switch (timing) {
      case 'GBM':
        if (runtime.ghostContextActive) {
          score += 10;
        }
        break;
      case 'CTR':
        if (runtime.counterContextActive) {
          score += 10;
        }
        break;
      case 'RES':
        if (runtime.rescueStress) {
          score += 10;
        }
        break;
      case 'AID':
        if (runtime.aidContextActive) {
          score += 8;
        }
        break;
      case 'CAS':
        if (runtime.cascadeContextActive) {
          score += 8;
        }
        break;
      case 'PHZ':
        if (runtime.phaseBoundaryActive) {
          score += 8;
        }
        break;
      case 'PSK':
        if (runtime.pressureSpike) {
          score += 8;
        }
        break;
      case 'END':
        if (runtime.endStateNear) {
          score += 8;
        }
        break;
      case 'FATE':
        if (runtime.fateStress) {
          score += 8;
        }
        break;
      default:
        break;
    }

    return score;
  }

  private pickPreferredTiming(
    legalTimings: readonly TimingClass[],
    checks: readonly TimingCheckResult[],
    doctrine: TimingDoctrineContext,
  ): TimingClass | null {
    if (legalTimings.length === 0) {
      return null;
    }

    const ranked = [...checks]
      .filter((check) => legalTimings.includes(check.timing))
      .sort((left, right) => {
        if (right.doctrineWeight !== left.doctrineWeight) {
          return right.doctrineWeight - left.doctrineWeight;
        }

        const preferredLeft = doctrine.preferredTimings.indexOf(left.timing);
        const preferredRight = doctrine.preferredTimings.indexOf(right.timing);

        const leftRank = preferredLeft === -1 ? Number.MAX_SAFE_INTEGER : preferredLeft;
        const rightRank = preferredRight === -1 ? Number.MAX_SAFE_INTEGER : preferredRight;

        if (leftRank !== rightRank) {
          return leftRank - rightRank;
        }

        return this.timingOrderIndex(left.timing) - this.timingOrderIndex(right.timing);
      });

    return ranked[0]?.timing ?? legalTimings[0] ?? null;
  }

  private buildAuditSummary(
    snapshot: RunStateSnapshot,
    card: CardInstance,
    allowed: boolean,
    legalTimings: readonly TimingClass[],
    preferredTiming: TimingClass | null,
    checks: readonly TimingCheckResult[],
    runtime: TimingRuntimeContext,
  ): string {
    const failureReasons = checks
      .filter((check) => !check.allowed)
      .flatMap((check) => check.reasons)
      .slice(0, 5)
      .join(', ');

    if (!allowed) {
      return [
        `Card ${card.definitionId} is timing-illegal on tick ${snapshot.tick}`,
        `in mode ${snapshot.mode}`,
        `(${snapshot.phase})`,
        `because no declared timing window survived runtime doctrine.`,
        `Primary blocks: ${failureReasons || 'none recorded'}.`,
      ].join(' ');
    }

    return [
      `Card ${card.definitionId} is timing-legal on tick ${snapshot.tick}`,
      `in mode ${snapshot.mode}`,
      `(${snapshot.phase}).`,
      `Legal timings: ${legalTimings.join(', ')}.`,
      `Preferred timing: ${preferredTiming ?? 'none'}.`,
      `Windows active=${runtime.activeWindowCount}, frozen=${runtime.frozenWindowCount}.`,
    ].join(' ');
  }

  private buildTimingSummary(
    timing: TimingClass,
    allowed: boolean,
    reasons: readonly TimingReasonCode[],
    digest: TimingWindowDigest,
    doctrineWeight: number,
  ): string {
    return [
      `${timing}`,
      allowed ? 'allowed' : 'blocked',
      `weight=${doctrineWeight}`,
      `activeWindows=${digest.activeCount}`,
      `explicitMatches=${digest.explicitCardMatchCount}`,
      `reasons=${reasons.join('|')}`,
    ].join(' ');
  }

  /* ────────────────────────────────────────────────────────────────────────── */

  private matchingWindowsForTiming(
    snapshot: RunStateSnapshot,
    card: CardInstance,
    timing: TimingClass,
  ): readonly RuntimeDecisionWindowSnapshot[] {
    const windows = Object.values(snapshot.timers.activeDecisionWindows);

    return Object.freeze(
      windows.filter((window) => this.windowMatchesTiming(window, card, snapshot, timing)),
    );
  }

  private windowMatchesTiming(
    window: RuntimeDecisionWindowSnapshot,
    card: CardInstance,
    snapshot: RunStateSnapshot,
    timing: TimingClass,
  ): boolean {
    if (window.mode !== snapshot.mode) {
      return false;
    }

    if (window.consumed) {
      return false;
    }

    if (window.timingClass === timing) {
      return true;
    }

    if (timing === 'ANY') {
      return true;
    }

    if (this.isExplicitCardWindowMatch(window, card)) {
      return true;
    }

    const label = window.label.toLowerCase();
    const source = window.source.toLowerCase();

    return this.stringHintsSupportTiming(label, timing) || this.stringHintsSupportTiming(source, timing);
  }

  private isExplicitCardWindowMatch(
    window: RuntimeDecisionWindowSnapshot,
    card: CardInstance,
  ): boolean {
    if (window.cardInstanceId !== null && window.cardInstanceId === card.instanceId) {
      return true;
    }

    return (
      this.metadataMatchesCard(window.metadata, card.instanceId) ||
      this.metadataMatchesCard(window.metadata, card.definitionId)
    );
  }

  private scoreWindowMatch(
    window: RuntimeDecisionWindowSnapshot,
    card: CardInstance,
    timing: TimingClass,
  ): number {
    let score = 0;

    if (this.isExplicitCardWindowMatch(window, card)) {
      score += DECISION_WINDOW_CARD_MATCH_WEIGHT;
    }

    if (window.timingClass === timing) {
      score += DECISION_WINDOW_TIMING_MATCH_WEIGHT;
    }

    if (score === 0) {
      score += DECISION_WINDOW_GENERIC_MATCH_WEIGHT;
    }

    if (window.frozen) {
      score += 1;
    }

    return score;
  }

  private hasActiveTimingWindow(
    snapshot: RunStateSnapshot,
    timing: TimingClass,
  ): boolean {
    return Object.values(snapshot.timers.activeDecisionWindows).some(
      (window) => !window.consumed && window.mode === snapshot.mode && window.timingClass === timing,
    );
  }

  private hasExplicitTimingWindow(
    snapshot: RunStateSnapshot,
    card: CardInstance,
    timing: TimingClass,
  ): boolean {
    return Object.values(snapshot.timers.activeDecisionWindows).some(
      (window) =>
        !window.consumed &&
        window.mode === snapshot.mode &&
        window.timingClass === timing &&
        this.isExplicitCardWindowMatch(window, card),
    );
  }

  /* ────────────────────────────────────────────────────────────────────────── */

  private hasDeclaredTiming(card: CardInstance, timing: TimingClass): boolean {
    return card.timingClass.includes(timing);
  }

  private isTimingSupportedByModeDoctrine(
    mode: RunStateSnapshot['mode'],
    timing: TimingClass,
  ): boolean {
    return (MODE_TIMING_DOCTRINE[mode] ?? EMPTY_TIMINGS).includes(timing);
  }

  private isTimingSupportedByDeckDoctrine(
    deckType: DeckType,
    timing: TimingClass,
  ): boolean {
    return (DECK_TIMING_DOCTRINE[deckType] ?? EMPTY_TIMINGS).includes(timing);
  }

  private isTimingSupportedByTagDoctrine(
    tags: readonly string[],
    timing: TimingClass,
  ): boolean {
    return tags.some((tag) =>
      (TAG_TIMING_DOCTRINE[tag] ?? EMPTY_TIMINGS).includes(timing),
    );
  }

  private computePreferredTimings(
    deckType: DeckType,
    declared: readonly TimingClass[],
    tagSupported: readonly TimingClass[],
    mode: RunStateSnapshot['mode'],
  ): readonly TimingClass[] {
    const result: TimingClass[] = [];
    const seen = new Set<TimingClass>();

    const push = (timing: TimingClass): void => {
      if (!declared.includes(timing)) {
        return;
      }

      if (!seen.has(timing)) {
        seen.add(timing);
        result.push(timing);
      }
    };

    for (const timing of DECK_TIMING_DOCTRINE[deckType] ?? EMPTY_TIMINGS) {
      push(timing);
    }

    for (const timing of tagSupported) {
      push(timing);
    }

    for (const timing of MODE_TIMING_DOCTRINE[mode] ?? EMPTY_TIMINGS) {
      push(timing);
    }

    for (const timing of declared) {
      push(timing);
    }

    return Object.freeze(result);
  }

  private collectTagSupportedTimings(tags: readonly string[]): readonly TimingClass[] {
    const result: TimingClass[] = [];
    const seen = new Set<TimingClass>();

    for (const tag of tags) {
      const supported = TAG_TIMING_DOCTRINE[tag] ?? EMPTY_TIMINGS;
      for (const timing of supported) {
        if (!seen.has(timing)) {
          seen.add(timing);
          result.push(timing);
        }
      }
    }

    return Object.freeze(this.sortTimings(result));
  }

  private collectTagTimingHits(tags: readonly string[]): readonly string[] {
    return Object.freeze(
      tags.filter((tag) => Object.prototype.hasOwnProperty.call(TAG_TIMING_DOCTRINE, tag)),
    );
  }

  /* ────────────────────────────────────────────────────────────────────────── */

  private hasCounterableAttack(snapshot: RunStateSnapshot): boolean {
    return snapshot.battle.pendingAttacks.some((attack) =>
      (COUNTERABLE_ATTACK_CATEGORIES as readonly string[]).includes(attack.category),
    );
  }

  private hasRecentMarkerForCard(
    snapshot: RunStateSnapshot,
    cardDefinitionId: string,
    tickWindow: number,
  ): boolean {
    return snapshot.cards.ghostMarkers.some((marker) => {
      const withinTickWindow = Math.abs(marker.tick - snapshot.tick) <= tickWindow;

      if (!withinTickWindow) {
        return false;
      }

      return marker.cardId === null || marker.cardId === cardDefinitionId;
    });
  }

  private hasRecentAnyMarker(
    snapshot: RunStateSnapshot,
    tickWindow: number,
  ): boolean {
    return snapshot.cards.ghostMarkers.some(
      (marker) => Math.abs(marker.tick - snapshot.tick) <= tickWindow,
    );
  }

  private estimateTicksRemaining(
    snapshot: RunStateSnapshot,
    remainingMs: number,
  ): number {
    const tickDuration = Math.max(snapshot.timers.currentTickDurationMs, 1);
    return Math.ceil(remainingMs / tickDuration);
  }

  private detectRecentDeckTypeDepth(
    history: readonly string[],
    deckType: DeckType,
    depth: number,
  ): number {
    const start = Math.max(0, history.length - depth);
    const recent = history.slice(start);

    for (let index = recent.length - 1; index >= 0; index -= 1) {
      const definitionId = recent[index];
      const definition = this.registry.get(definitionId);

      if (definition?.deckType === deckType) {
        return recent.length - index;
      }
    }

    return 0;
  }

  private countWarningHints(
    warnings: readonly string[],
    hints: readonly string[],
  ): number {
    return warnings.reduce((count, warning) => {
      const normalized = warning.toUpperCase();
      if (hints.some((hint) => normalized.includes(hint))) {
        return count + 1;
      }
      return count;
    }, 0);
  }

  private isWarningQuarantined(warnings: readonly string[]): boolean {
    return warnings.some((warning) => {
      const normalized = warning.toUpperCase();
      return TIMING_QUARANTINE_WARNING_CODES.some((code) => normalized.includes(code));
    });
  }

  /* ────────────────────────────────────────────────────────────────────────── */

  private metadataMatchesCard(
    metadata: Readonly<Record<string, string | number | boolean | null>>,
    id: string,
  ): boolean {
    return Object.values(metadata).some((value) => String(value) === id);
  }

  private stringHintsSupportTiming(
    value: string,
    timing: TimingClass,
  ): boolean {
    switch (timing) {
      case 'PRE':
        return this.stringContainsAnyHint(value, PRE_WINDOW_SOURCE_HINTS);
      case 'POST':
        return this.stringContainsAnyHint(value, POST_WINDOW_SOURCE_HINTS);
      case 'FATE':
        return this.stringContainsAnyHint(value, FATE_WINDOW_SOURCE_HINTS);
      case 'CTR':
        return this.stringContainsAnyHint(value, COUNTER_WINDOW_SOURCE_HINTS);
      case 'RES':
        return this.stringContainsAnyHint(value, RESCUE_WINDOW_SOURCE_HINTS);
      case 'AID':
        return this.stringContainsAnyHint(value, AID_WINDOW_SOURCE_HINTS);
      case 'GBM':
        return this.stringContainsAnyHint(value, GBM_WINDOW_SOURCE_HINTS);
      case 'CAS':
        return this.stringContainsAnyHint(value, CAS_WINDOW_SOURCE_HINTS);
      case 'PHZ':
        return this.stringContainsAnyHint(value, PHZ_WINDOW_SOURCE_HINTS);
      case 'PSK':
        return this.stringContainsAnyHint(value, PSK_WINDOW_SOURCE_HINTS);
      case 'END':
        return this.stringContainsAnyHint(value, END_WINDOW_SOURCE_HINTS);
      case 'ANY':
        return true;
      default:
        return false;
    }
  }

  private stringContainsAnyHint(
    value: string,
    hints: readonly string[],
  ): boolean {
    return hints.some((hint) => value.includes(hint));
  }

  /* ────────────────────────────────────────────────────────────────────────── */

  private normalizeTimingList(
    timings: readonly TimingClass[],
  ): TimingClass[] {
    const result: TimingClass[] = [];
    const seen = new Set<TimingClass>();

    for (const timing of timings) {
      if (!seen.has(timing)) {
        seen.add(timing);
        result.push(timing);
      }
    }

    return result;
  }

  private sortTimings(
    timings: readonly TimingClass[],
  ): TimingClass[] {
    return [...timings].sort(
      (left, right) => this.timingOrderIndex(left) - this.timingOrderIndex(right),
    );
  }

  private timingOrderIndex(timing: TimingClass): number {
    const index = TIMING_ORDER.indexOf(timing);
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  }

  private uniqueReasons(
    reasons: readonly TimingReasonCode[],
  ): TimingReasonCode[] {
    const result: TimingReasonCode[] = [];
    const seen = new Set<TimingReasonCode>();

    for (const reason of reasons) {
      if (!seen.has(reason)) {
        seen.add(reason);
        result.push(reason);
      }
    }

    return result;
  }

  private emptyWindowDigest(
    timing: TimingClass,
  ): TimingWindowDigest {
    return {
      timing,
      activeCount: 0,
      frozenCount: 0,
      explicitCardMatchCount: 0,
      matchedWindowIds: Object.freeze([] as readonly string[]),
      bestMatchScore: 0,
    };
  }

  private bandRank(
    band: PressureBand,
  ): number {
    switch (band) {
      case 'CALM':
        return 0;
      case 'BUILDING':
        return 1;
      case 'ELEVATED':
        return 2;
      case 'HIGH':
        return 3;
      case 'CRITICAL':
        return 4;
      default:
        return -1;
    }
  }

  private rank(tier: PressureTier): number {
    switch (tier) {
      case 'T0':
        return 0;
      case 'T1':
        return 1;
      case 'T2':
        return 2;
      case 'T3':
        return 3;
      case 'T4':
        return 4;
      default:
        return -1;
    }
  }

  /* ──────────────────────────────────────────────────────────────────────────
   * Phase boundary urgency classification
   * ────────────────────────────────────────────────────────────────────────── */

  /**
   * Classifies the urgency level for playing a phase-boundary card (PHZ) based
   * on how many phase-boundary windows remain in the current snapshot.
   *
   * Uses the three threshold constants:
   * - `PHASE_BOUNDARY_HIGH_URGENCY_REMAINING` (1) → CRITICAL
   * - `PHASE_BOUNDARY_MEDIUM_URGENCY_REMAINING` (2) → HIGH
   * - `PHASE_BOUNDARY_LOW_URGENCY_REMAINING` (4) → MEDIUM
   *
   * Consumed by:
   * - UX urgency badge on phase-boundary cards
   * - AI planner: prioritize PHZ cards when windows are low
   * - Chat narrator: "You are running out of phase-boundary windows."
   */
  public classifyPhaseBoundaryUrgency(
    windowsRemaining: number,
  ): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE' {
    if (windowsRemaining <= 0) {
      return 'NONE';
    }
    if (windowsRemaining <= PHASE_BOUNDARY_HIGH_URGENCY_REMAINING) {
      return 'CRITICAL';
    }
    if (windowsRemaining <= PHASE_BOUNDARY_MEDIUM_URGENCY_REMAINING) {
      return 'HIGH';
    }
    if (windowsRemaining <= PHASE_BOUNDARY_LOW_URGENCY_REMAINING) {
      return 'MEDIUM';
    }
    return 'LOW';
  }

  /**
   * Returns the phase-boundary urgency label for the current snapshot's
   * remaining phase-boundary windows. Convenience wrapper over
   * `classifyPhaseBoundaryUrgency` that reads the snapshot directly.
   */
  public getPhaseBoundaryUrgencyFromSnapshot(
    snapshot: RunStateSnapshot,
  ): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE' {
    return this.classifyPhaseBoundaryUrgency(
      snapshot.modeState.phaseBoundaryWindowsRemaining,
    );
  }

  /* ──────────────────────────────────────────────────────────────────────────
   * Trust-based timing opportunity classification
   * ────────────────────────────────────────────────────────────────────────── */

  /**
   * Classifies whether a timing opportunity exists based on trust health.
   *
   * Uses `LOW_TRUST_THRESHOLD` (45) to detect low-trust states.
   * In coop mode a trust level below 45 is a strong signal to play
   * RESCUE / AID / TRUST timing-class cards urgently.
   *
   * Consumed by:
   * - AID / RESCUE card urgency overlay
   * - AI planner: escalate cooperative card priority when trust is low
   * - Chat narrator: "Your team's trust is critically low."
   */
  public classifyTrustTimingOpportunity(
    snapshot: RunStateSnapshot,
    card: CardInstance,
  ): 'TRUST_CRITICAL' | 'TRUST_LOW' | 'TRUST_OK' | 'NOT_APPLICABLE' {
    if (snapshot.mode !== 'coop') {
      return 'NOT_APPLICABLE';
    }
    if (
      !card.timingClass.includes('AID') &&
      !card.timingClass.includes('RES') &&
      !card.card.tags.includes('trust')
    ) {
      return 'NOT_APPLICABLE';
    }
    const trustScores = Object.values(snapshot.modeState.trustScores);
    if (trustScores.length === 0) {
      return 'TRUST_OK';
    }
    const minTrust = Math.min(...trustScores);
    if (minTrust < RESCUE_TRUST_THRESHOLD) {
      return 'TRUST_CRITICAL';
    }
    if (minTrust < LOW_TRUST_THRESHOLD) {
      return 'TRUST_LOW';
    }
    return 'TRUST_OK';
  }

  /* ──────────────────────────────────────────────────────────────────────────
   * Pressure-based timing opportunity classification
   * ────────────────────────────────────────────────────────────────────────── */

  /**
   * Classifies the timing opportunity for pressure-sensitive cards based on
   * the current snapshot pressure score.
   *
   * Uses `ELEVATED_PRESSURE_SCORE` (0.5) as the floor for flagging that
   * pressure-reactive cards (PSK / CAS / CTR timings) should be considered
   * more urgently.
   *
   * Consumed by:
   * - PSK / CAS card urgency overlay
   * - AI planner: escalate pressure-reactive cards when pressure is elevated
   * - Chat narrator: "Pressure is building — consider your reaction cards."
   */
  public classifyPressureTimingOpportunity(
    snapshot: RunStateSnapshot,
    card: CardInstance,
  ): 'CRITICAL' | 'ELEVATED' | 'NORMAL' | 'NOT_APPLICABLE' {
    const isPressureCard =
      card.timingClass.includes('PSK') ||
      card.timingClass.includes('CAS') ||
      card.timingClass.includes('CTR') ||
      card.card.tags.includes('resilience') ||
      card.card.tags.includes('cascade');

    if (!isPressureCard) {
      return 'NOT_APPLICABLE';
    }

    const pressureScore = snapshot.pressure.score;

    if (pressureScore >= CRITICAL_PRESSURE_SCORE) {
      return 'CRITICAL';
    }
    if (pressureScore >= ELEVATED_PRESSURE_SCORE) {
      return 'ELEVATED';
    }
    return 'NORMAL';
  }

  /**
   * Returns whether elevated pressure conditions make pressure-reactive cards
   * worth playing NOW rather than holding for a better window.
   * Uses `ELEVATED_PRESSURE_SCORE` (0.5) as the activation threshold.
   */
  public isElevatedPressureOpportunityActive(
    snapshot: RunStateSnapshot,
  ): boolean {
    const pressureScore = snapshot.pressure.score;
    return pressureScore >= ELEVATED_PRESSURE_SCORE;
  }

  /* ──────────────────────────────────────────────────────────────────────────
   * Comprehensive timing window advisory
   * ────────────────────────────────────────────────────────────────────────── */

  /**
   * Builds a comprehensive timing window advisory for a specific card in the
   * current snapshot, combining:
   * - Base timing legality (`audit`)
   * - Phase boundary urgency (uses `PHASE_BOUNDARY_*` constants)
   * - Trust opportunity (uses `LOW_TRUST_THRESHOLD`)
   * - Pressure opportunity (uses `ELEVATED_PRESSURE_SCORE`)
   *
   * Consumed by:
   * - UX card tooltip "Is now a good time to play this?"
   * - AI hand planner urgency scoring
   * - Chat narrator scenario framing
   */
  public buildTimingWindowAdvisory(
    snapshot: RunStateSnapshot,
    card: CardInstance,
  ): TimingWindowAdvisory {
    const auditResult = this.evaluate(snapshot, card);
    const phaseBoundaryUrgency = this.getPhaseBoundaryUrgencyFromSnapshot(snapshot);
    const trustOpportunity = this.classifyTrustTimingOpportunity(snapshot, card);
    const pressureOpportunity = this.classifyPressureTimingOpportunity(snapshot, card);

    const isPhaseBoundaryCard = card.timingClass.includes('PHZ');
    const isReactionCard =
      card.timingClass.includes('CTR') ||
      card.timingClass.includes('RES') ||
      card.timingClass.includes('AID') ||
      card.timingClass.includes('CAS') ||
      card.timingClass.includes('PSK');

    let overallUrgency: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'OK';

    if (!auditResult.allowed) {
      overallUrgency = 'LOW';
    } else if (
      isPhaseBoundaryCard &&
      (phaseBoundaryUrgency === 'CRITICAL' || phaseBoundaryUrgency === 'HIGH')
    ) {
      overallUrgency = 'CRITICAL';
    } else if (
      trustOpportunity === 'TRUST_CRITICAL' ||
      pressureOpportunity === 'CRITICAL'
    ) {
      overallUrgency = 'CRITICAL';
    } else if (
      trustOpportunity === 'TRUST_LOW' ||
      pressureOpportunity === 'ELEVATED' ||
      (isPhaseBoundaryCard && phaseBoundaryUrgency === 'MEDIUM')
    ) {
      overallUrgency = 'HIGH';
    } else if (isReactionCard && auditResult.legalTimings.length > 0) {
      overallUrgency = 'MEDIUM';
    } else {
      overallUrgency = 'OK';
    }

    const narrativeFragments: string[] = [];

    if (!auditResult.allowed) {
      narrativeFragments.push(
        `${card.definitionId} cannot be played right now: ${auditResult.summary}`,
      );
    } else {
      narrativeFragments.push(
        `${card.definitionId} may be played in timing: ${auditResult.legalTimings.join(', ')}.`,
      );
    }

    if (isPhaseBoundaryCard && phaseBoundaryUrgency !== 'LOW') {
      narrativeFragments.push(
        `Phase-boundary urgency: ${phaseBoundaryUrgency} (${snapshot.modeState.phaseBoundaryWindowsRemaining} windows remaining).`,
      );
    }

    if (trustOpportunity !== 'NOT_APPLICABLE' && trustOpportunity !== 'TRUST_OK') {
      narrativeFragments.push(`Trust state: ${trustOpportunity}.`);
    }

    if (pressureOpportunity !== 'NOT_APPLICABLE' && pressureOpportunity !== 'NORMAL') {
      narrativeFragments.push(`Pressure state: ${pressureOpportunity}.`);
    }

    return Object.freeze({
      card,
      auditResult,
      overallUrgency,
      phaseBoundaryUrgency,
      trustOpportunity,
      pressureOpportunity,
      narrative: narrativeFragments.join(' '),
    });
  }

  /**
   * Builds a timing hand summary for an entire hand of cards, returning
   * aggregate counts, urgency distribution, and per-timing-class counts.
   *
   * Consumed by:
   * - UX hand-state header ("3 reaction cards available")
   * - AI planner: know what timing coverage the hand provides
   * - Chat narrator: describe the hand posture
   */
  public buildHandTimingSummary(
    snapshot: RunStateSnapshot,
    hand: readonly CardInstance[],
  ): TimingHandSummary {
    let legalCount = 0;
    let blockedCount = 0;
    let criticalUrgencyCount = 0;
    const timingClassCounts: Record<string, number> = {};

    for (const card of hand) {
      const audit = this.evaluate(snapshot, card);
      if (audit.allowed) {
        legalCount++;
        for (const tc of audit.legalTimings) {
          timingClassCounts[tc] = (timingClassCounts[tc] ?? 0) + 1;
        }
      } else {
        blockedCount++;
      }
      const advisory = this.buildTimingWindowAdvisory(snapshot, card);
      if (advisory.overallUrgency === 'CRITICAL') {
        criticalUrgencyCount++;
      }
    }

    const phaseBoundaryUrgency = this.getPhaseBoundaryUrgencyFromSnapshot(snapshot);
    const pressureActive = this.isElevatedPressureOpportunityActive(snapshot);

    return Object.freeze({
      mode: snapshot.mode,
      totalCards: hand.length,
      legalCards: legalCount,
      blockedCards: blockedCount,
      criticalUrgencyCount,
      timingClassCounts: Object.freeze({ ...timingClassCounts }),
      phaseBoundaryUrgency,
      isPressureElevated: pressureActive,
    });
  }

  /**
   * Evaluates a batch of cards and returns their timing audit results.
   * Useful for AI hand analysis and legality report generation.
   */
  public evaluateBatch(
    snapshot: RunStateSnapshot,
    cards: readonly CardInstance[],
  ): readonly CardTimingAudit[] {
    return Object.freeze(cards.map((card) => this.evaluate(snapshot, card)));
  }

  /**
   * Returns the subset of cards from a hand that have at least one legal
   * timing in the current snapshot.
   */
  public filterLegalCards(
    snapshot: RunStateSnapshot,
    hand: readonly CardInstance[],
  ): readonly CardInstance[] {
    return Object.freeze(
      hand.filter((card) => this.isLegal(snapshot, card)),
    );
  }

  /**
   * Returns the subset of cards whose timing urgency is CRITICAL or HIGH,
   * i.e. cards that should be considered for immediate play.
   * Uses `PHASE_BOUNDARY_*` and `ELEVATED_PRESSURE_SCORE` thresholds internally.
   */
  public filterUrgentCards(
    snapshot: RunStateSnapshot,
    hand: readonly CardInstance[],
  ): readonly CardInstance[] {
    return Object.freeze(
      hand.filter((card) => {
        const advisory = this.buildTimingWindowAdvisory(snapshot, card);
        return advisory.overallUrgency === 'CRITICAL' || advisory.overallUrgency === 'HIGH';
      }),
    );
  }
}

const EMPTY_TIMINGS: readonly TimingClass[] = Object.freeze([] as readonly TimingClass[]);

/* ──────────────────────────────────────────────────────────────────────────────
 * Batch / advisory / hand summary result shapes
 * ──────────────────────────────────────────────────────────────────────────── */

export interface TimingWindowAdvisory {
  readonly card: CardInstance;
  readonly auditResult: CardTimingAudit;
  readonly overallUrgency: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'OK';
  readonly phaseBoundaryUrgency: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  readonly trustOpportunity: 'TRUST_CRITICAL' | 'TRUST_LOW' | 'TRUST_OK' | 'NOT_APPLICABLE';
  readonly pressureOpportunity: 'CRITICAL' | 'ELEVATED' | 'NORMAL' | 'NOT_APPLICABLE';
  readonly narrative: string;
}

export interface TimingHandSummary {
  readonly mode: string;
  readonly totalCards: number;
  readonly legalCards: number;
  readonly blockedCards: number;
  readonly criticalUrgencyCount: number;
  readonly timingClassCounts: Readonly<Record<string, number>>;
  readonly phaseBoundaryUrgency: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  readonly isPressureElevated: boolean;
}

/* ──────────────────────────────────────────────────────────────────────────────
 * Doctrine utility helpers
 * ──────────────────────────────────────────────────────────────────────────── */

/** Returns all timing classes supported by a given mode. */
export function getTimingClassesForMode(mode: string): readonly TimingClass[] {
  return MODE_TIMING_DOCTRINE[mode] ?? (EMPTY_TIMINGS as readonly TimingClass[]);
}

/** Returns all timing classes associated with a given deck type by doctrine. */
export function getTimingClassesForDeckType(deckType: DeckType): readonly TimingClass[] {
  return DECK_TIMING_DOCTRINE[deckType] ?? (EMPTY_TIMINGS as readonly TimingClass[]);
}

/** Returns all timing classes associated with a given tag. */
export function getTimingClassesForTag(tag: string): readonly TimingClass[] {
  return TAG_TIMING_DOCTRINE[tag] ?? (EMPTY_TIMINGS as readonly TimingClass[]);
}

/** Returns the END_WINDOW_MS threshold in milliseconds. */
export function getEndWindowMs(): number {
  return END_WINDOW_MS;
}

/** Returns the GHOST_MARKER_WINDOW_TICKS threshold. */
export function getGhostMarkerWindowTicks(): number {
  return GHOST_MARKER_WINDOW_TICKS;
}

/** Returns the GHOST_MARKER_HARD_WINDOW_TICKS threshold. */
export function getGhostMarkerHardWindowTicks(): number {
  return GHOST_MARKER_HARD_WINDOW_TICKS;
}

/** Returns the RESCUE_TRUST_THRESHOLD. */
export function getRescueTrustThreshold(): number {
  return RESCUE_TRUST_THRESHOLD;
}

/** Returns the LOW_TRUST_THRESHOLD (45) — trust below this is considered "low". */
export function getLowTrustThreshold(): number {
  return LOW_TRUST_THRESHOLD;
}

/** Returns the STABLE_TRUST_THRESHOLD. */
export function getStableTrustThreshold(): number {
  return STABLE_TRUST_THRESHOLD;
}

/** Returns the ELEVATED_PRESSURE_SCORE (0.5) — pressure above this warrants urgency. */
export function getElevatedPressureScore(): number {
  return ELEVATED_PRESSURE_SCORE;
}

/** Returns the CRITICAL_PRESSURE_SCORE. */
export function getCriticalPressureScore(): number {
  return CRITICAL_PRESSURE_SCORE;
}

/** Returns the HIGH_PRESSURE_SCORE. */
export function getHighPressureScore(): number {
  return HIGH_PRESSURE_SCORE;
}

/** Returns the PHASE_BOUNDARY_HIGH_URGENCY_REMAINING threshold (1 window = CRITICAL). */
export function getPhaseBoundaryHighUrgencyRemaining(): number {
  return PHASE_BOUNDARY_HIGH_URGENCY_REMAINING;
}

/** Returns the PHASE_BOUNDARY_MEDIUM_URGENCY_REMAINING threshold (2 windows = HIGH). */
export function getPhaseBoundaryMediumUrgencyRemaining(): number {
  return PHASE_BOUNDARY_MEDIUM_URGENCY_REMAINING;
}

/** Returns the PHASE_BOUNDARY_LOW_URGENCY_REMAINING threshold (4 windows = MEDIUM). */
export function getPhaseBoundaryLowUrgencyRemaining(): number {
  return PHASE_BOUNDARY_LOW_URGENCY_REMAINING;
}

/** Returns all counterable attack categories. */
export function getCounterableAttackCategories(): readonly string[] {
  return COUNTERABLE_ATTACK_CATEGORIES;
}

/** Returns all negative attack categories (a superset of counterable). */
export function getNegativeAttackCategories(): readonly string[] {
  return NEGATIVE_ATTACK_CATEGORIES;
}

/** Returns all timing classes in canonical order. */
export function getTimingOrder(): readonly TimingClass[] {
  return TIMING_ORDER;
}

/** Returns all mode timing doctrine entries. */
export function getModeDoctrine(mode: string): readonly TimingClass[] {
  return MODE_TIMING_DOCTRINE[mode] ?? (EMPTY_TIMINGS as readonly TimingClass[]);
}

/* ──────────────────────────────────────────────────────────────────────────────
 * Module authority object
 * ──────────────────────────────────────────────────────────────────────────── */

export const CARD_TIMING_VALIDATOR_MODULE_AUTHORITY = Object.freeze({
  module: 'CardTimingValidator',
  version: '2.0.0',
  surface: 'engine/cards/timing',
  exports: Object.freeze([
    'CardTimingValidator',
    'TimingWindowAdvisory',
    'TimingHandSummary',
    'getTimingClassesForMode',
    'getTimingClassesForDeckType',
    'getTimingClassesForTag',
    'getEndWindowMs',
    'getGhostMarkerWindowTicks',
    'getGhostMarkerHardWindowTicks',
    'getRescueTrustThreshold',
    'getLowTrustThreshold',
    'getStableTrustThreshold',
    'getElevatedPressureScore',
    'getCriticalPressureScore',
    'getHighPressureScore',
    'getPhaseBoundaryHighUrgencyRemaining',
    'getPhaseBoundaryMediumUrgencyRemaining',
    'getPhaseBoundaryLowUrgencyRemaining',
    'getCounterableAttackCategories',
    'getNegativeAttackCategories',
    'getTimingOrder',
    'getModeDoctrine',
    'CARD_TIMING_VALIDATOR_MODULE_AUTHORITY',
  ] as const),
});
