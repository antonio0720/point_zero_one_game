/*
 * POINT ZERO ONE — BACKEND ENGINE CORE
 * /backend/src/game/engine/cards/CardLegalityService.ts
 *
 * Doctrine:
 * - backend owns final legality
 * - legality is evaluated against the actual runtime snapshot, not UI intent
 * - hand presence, overlay materialization, timing, targeting, affordability,
 *   decision-window exclusivity, and mode-native doctrine all participate
 * - legality must remain deterministic for the same snapshot, actor, card, and target
 * - diagnostics are first-class so replay, proof, test harnesses, and AI planners
 *   can explain why a card was or was not legal without mutating state
 */

import type {
  CardDefinition,
  CardInstance,
  DeckType,
  EffectPayload,
  ModeCode,
  Targeting,
  TimingClass,
} from '../core/GamePrimitives';
import type {
  RunStateSnapshot,
  RuntimeDecisionWindowSnapshot,
} from '../core/RunStateSnapshot';
import { CardOverlayResolver } from './CardOverlayResolver';
import { CardRegistry } from './CardRegistry';
import { CardTargetingResolver } from './CardTargetingResolver';
import { CardTimingValidator } from './CardTimingValidator';

// ═════════════════════════════════════════════════════════════════════════════
// Public report types
// ═════════════════════════════════════════════════════════════════════════════

export type CardLegalityStage =
  | 'LOOKUP'
  | 'HAND'
  | 'OVERLAY'
  | 'INSTANCE'
  | 'TIMING'
  | 'TARGETING'
  | 'DECISION_WINDOWS'
  | 'RESOURCE_LANES'
  | 'MODE_RULES'
  | 'SPECIAL_RULES'
  | 'FINALIZE';

export type CardLegalityFailureCode =
  | 'UNKNOWN_CARD'
  | 'CARD_NOT_IN_HAND'
  | 'NO_LEGAL_INSTANCE'
  | 'CARD_DEFINITION_MODE_ILLEGAL'
  | 'CARD_OVERLAY_DISABLED'
  | 'INSTANCE_MODE_DRIFT'
  | 'INSTANCE_COST_DRIFT'
  | 'INSTANCE_TARGETING_DRIFT'
  | 'INSTANCE_TIMING_DRIFT'
  | 'INSTANCE_TAG_DRIFT'
  | 'INSTANCE_DECAY_EXPIRED'
  | 'TIMING_WINDOW_ILLEGAL'
  | 'TARGETING_ILLEGAL'
  | 'EXCLUSIVE_WINDOW_BLOCKED'
  | 'EXCLUSIVE_WINDOW_MISMATCH'
  | 'INSUFFICIENT_CASH'
  | 'INSUFFICIENT_BATTLE_BUDGET'
  | 'INSUFFICIENT_SHARED_TREASURY'
  | 'INSUFFICIENT_HOLD_CHARGES'
  | 'INSUFFICIENT_COUNTER_INTEL'
  | 'DEFECTION_SEQUENCE_BROKEN'
  | 'DEFECTION_MODE_REQUIRED'
  | 'SHARED_TREASURY_REQUIRED'
  | 'GHOST_MARKERS_DISABLED'
  | 'GHOST_BASELINE_REQUIRED'
  | 'GHOST_MARKER_DATA_REQUIRED'
  | 'PVP_CONTEXT_REQUIRED'
  | 'COOP_CONTEXT_REQUIRED'
  | 'SOLO_CONTEXT_REQUIRED'
  | 'GHOST_CONTEXT_REQUIRED'
  | 'TEAM_CONTEXT_REQUIRED'
  | 'ROLE_ASSIGNMENT_REQUIRED'
  | 'COUNTER_WINDOW_REQUIRED'
  | 'RESCUE_WINDOW_REQUIRED'
  | 'AID_CONTEXT_REQUIRED'
  | 'CASCADE_CONTEXT_REQUIRED'
  | 'PHASE_BOUNDARY_REQUIRED'
  | 'PRESSURE_SPIKE_REQUIRED'
  | 'END_WINDOW_REQUIRED'
  | 'HOLD_SYSTEM_DISABLED'
  | 'SYSTEMIC_OVERRIDE_TARGET_INVALID'
  | 'SPECIAL_RULE_VIOLATION';

export type CardRequirementKind =
  | 'CASH'
  | 'BATTLE_BUDGET'
  | 'SHARED_TREASURY'
  | 'HOLD_CHARGE'
  | 'COUNTER_INTEL';

export type CardSpendLane =
  | CardRequirementKind
  | 'NONE';

export type CardLegalityDetailValue =
  | string
  | number
  | boolean
  | null
  | readonly string[];

export type CardLegalityDetails = Readonly<
  Record<string, CardLegalityDetailValue>
>;

export interface CardLegalityCheck {
  readonly stage: CardLegalityStage;
  readonly code: CardLegalityFailureCode | 'PASS';
  readonly passed: boolean;
  readonly message: string;
  readonly details: CardLegalityDetails;
}

export interface CardLegalityRequirement {
  readonly kind: CardRequirementKind;
  readonly label: string;
  readonly required: number;
  readonly available: number;
  readonly satisfied: boolean;
  readonly source: string;
}

export interface CardResourceQuote {
  readonly spendLane: CardSpendLane;
  readonly requirements: readonly CardLegalityRequirement[];
  readonly affordable: boolean;
}

export interface CardCandidateLegalityReport {
  readonly instanceId: string;
  readonly origin: 'HAND' | 'SYNTHETIC';
  readonly card: CardInstance;
  readonly legal: boolean;
  readonly legalTimings: readonly TimingClass[];
  readonly resourceQuote: CardResourceQuote;
  readonly checks: readonly CardLegalityCheck[];
  readonly summary: string;
}

export interface CardLegalityReport {
  readonly definitionId: string;
  readonly actorId: string;
  readonly requestedTarget: Targeting;
  readonly mode: ModeCode;
  readonly legal: boolean;
  readonly selectedCard: CardInstance | null;
  readonly selectedInstanceId: string | null;
  readonly syntheticReference: CardInstance | null;
  readonly candidateReports: readonly CardCandidateLegalityReport[];
  readonly summary: string;
}

export interface CardLegalityOptions {
  readonly actorId?: string;
  readonly allowSynthetic?: boolean;
}

// ═════════════════════════════════════════════════════════════════════════════
// Constants and doctrine maps
// ═════════════════════════════════════════════════════════════════════════════

const LAST_DETAIL_EMPTY: readonly string[] = Object.freeze([] as const);
const NO_REQUIREMENTS: readonly CardLegalityRequirement[] = Object.freeze([] as const);
const NO_CHECKS: readonly CardLegalityCheck[] = Object.freeze([] as const);
const NO_TIMINGS: readonly TimingClass[] = Object.freeze([] as const);
const NO_CANDIDATES: readonly CardCandidateLegalityReport[] = Object.freeze([] as const);
const NO_WINDOWS: readonly RuntimeDecisionWindowSnapshot[] = Object.freeze([] as const);

const END_WINDOW_MS = 30_000;
const GHOST_MARKER_WINDOW_TICKS = 3;
const MIN_TEAM_CONTEXT_SIZE = 1;

const BATTLE_BUDGET_DECKS = new Set<DeckType>([
  'SABOTAGE',
  'COUNTER',
  'BLUFF',
]);

const GHOST_ANCHORED_DECKS = new Set<DeckType>([
  'GHOST',
]);

const RESCUE_ANCHORED_DECKS = new Set<DeckType>([
  'RESCUE',
]);

const COUNTER_ANCHORED_DECKS = new Set<DeckType>([
  'COUNTER',
]);

const AID_ANCHORED_DECKS = new Set<DeckType>([
  'AID',
]);

const TEAM_TARGETS = new Set<Targeting>(['TEAM', 'TEAMMATE']);

const SPECIAL_CARD_IDS = Object.freeze({
  BREAK_PACT: 'BREAK_PACT',
  SILENT_EXIT: 'SILENT_EXIT',
  ASSET_SEIZURE: 'ASSET_SEIZURE',
  SYSTEMIC_OVERRIDE: 'SYSTEMIC_OVERRIDE',
  CASCADE_BREAK: 'CASCADE_BREAK',
  TIME_DEBT_PAID: 'TIME_DEBT_PAID',
} as const);

const DEFECTION_SEQUENCE: Readonly<Record<string, 1 | 2 | 3>> = Object.freeze({
  BREAK_PACT: 1,
  SILENT_EXIT: 2,
  ASSET_SEIZURE: 3,
});

// ═════════════════════════════════════════════════════════════════════════════
// Helper utilities
// ═════════════════════════════════════════════════════════════════════════════

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

  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }

    seen.add(value);
    output.push(value);
  }

  return output;
}

function setEquals<T extends string>(
  left: readonly T[],
  right: readonly T[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  const a = [...left].sort();
  const b = [...right].sort();

  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) {
      return false;
    }
  }

  return true;
}

function semanticTag(tag: string): string {
  const separatorIndex = tag.indexOf(':');
  if (separatorIndex <= 0) {
    return tag;
  }

  return tag.slice(0, separatorIndex);
}

function semanticTagSet(tags: readonly string[]): ReadonlySet<string> {
  return new Set(tags.map(semanticTag));
}

function hasSemanticTag(card: CardInstance | CardDefinition, tag: string): boolean {
  return semanticTagSet(card.tags).has(tag);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function countKeys(record: Readonly<Record<string, unknown>>): number {
  return Object.keys(record).length;
}

function joinOrNone(values: readonly string[]): string {
  return values.length > 0 ? values.join(', ') : 'none';
}

function freezeDetails(
  details: Record<string, CardLegalityDetailValue>,
): CardLegalityDetails {
  return Object.freeze({ ...details });
}

function buildCheck(
  stage: CardLegalityStage,
  passed: boolean,
  message: string,
  details: Record<string, CardLegalityDetailValue> = {},
  code: CardLegalityFailureCode | 'PASS' = passed ? 'PASS' : 'SPECIAL_RULE_VIOLATION',
): CardLegalityCheck {
  return Object.freeze({
    stage,
    code,
    passed,
    message,
    details: freezeDetails(details),
  });
}

function buildRequirement(
  kind: CardRequirementKind,
  label: string,
  required: number,
  available: number,
  source: string,
): CardLegalityRequirement {
  const normalizedRequired = Math.max(0, Math.round(required));
  const normalizedAvailable = Math.max(0, Math.round(available));

  return Object.freeze({
    kind,
    label,
    required: normalizedRequired,
    available: normalizedAvailable,
    satisfied: normalizedAvailable >= normalizedRequired,
    source,
  });
}

function selectFirstFailingCheck(
  checks: readonly CardLegalityCheck[],
): CardLegalityCheck | null {
  for (const check of checks) {
    if (!check.passed) {
      return check;
    }
  }

  return null;
}

function summarizeChecks(
  checks: readonly CardLegalityCheck[],
  fallback: string,
): string {
  const failing = checks.filter((check) => !check.passed);

  if (failing.length === 0) {
    return fallback;
  }

  return failing.map((check) => check.message).join(' ');
}

function compareWeightedTags(
  candidateTags: readonly string[],
  canonicalTags: readonly string[],
): boolean {
  return setEquals(uniqueStrings(candidateTags), uniqueStrings(canonicalTags));
}

function resolveDefectionStep(definitionId: string): 1 | 2 | 3 | null {
  return DEFECTION_SEQUENCE[definitionId] ?? null;
}

function isDefectionCard(definitionId: string): boolean {
  return resolveDefectionStep(definitionId) !== null;
}

function isSharedObjectiveCard(
  definition: CardDefinition,
): boolean {
  return (
    definition.baseEffect.namedActionId === 'shared-objective' ||
    definition.tags.includes('shared-objective') ||
    definition.tags.includes('objective')
  );
}

function isCounterIntelConsumer(definition: CardDefinition): boolean {
  if ((definition.baseEffect.counterIntelDelta ?? 0) < 0) {
    return true;
  }

  return (
    definition.baseEffect.namedActionId === 'counter-intel-spend' ||
    definition.tags.includes('counter-intel')
  );
}

function resolveHoldChargeCost(definition: CardDefinition): number {
  const explicit = definition.baseEffect.holdChargeDelta ?? 0;
  if (explicit < 0) {
    return Math.abs(Math.round(explicit));
  }

  if (
    definition.baseEffect.namedActionId === 'hold-spend' ||
    definition.tags.includes('hold')
  ) {
    return 1;
  }

  return 0;
}

function resolveCounterIntelCost(definition: CardDefinition): number {
  const explicit = definition.baseEffect.counterIntelDelta ?? 0;
  if (explicit < 0) {
    return Math.abs(Math.round(explicit));
  }

  return isCounterIntelConsumer(definition) ? 1 : 0;
}

function resolveTreasurySpendSignal(definition: CardDefinition): boolean {
  return (
    (definition.baseEffect.treasuryDelta ?? 0) < 0 ||
    definition.baseEffect.namedActionId === 'shared-treasury-spend' ||
    definition.tags.includes('shared-treasury') ||
    definition.tags.includes('treasury')
  );
}

function resolveSpendLane(
  snapshot: RunStateSnapshot,
  definition: CardDefinition,
  requestedTarget: Targeting,
): CardSpendLane {
  if (definition.baseCost <= 0) {
    return 'NONE';
  }

  if (snapshot.mode === 'pvp' && BATTLE_BUDGET_DECKS.has(definition.deckType)) {
    return 'BATTLE_BUDGET';
  }

  if (
    snapshot.mode === 'coop' &&
    snapshot.modeState.sharedTreasury &&
    (resolveTreasurySpendSignal(definition) ||
      isSharedObjectiveCard(definition) ||
      TEAM_TARGETS.has(requestedTarget))
  ) {
    return 'SHARED_TREASURY';
  }

  return 'CASH';
}

function pressureRank(tier: RunStateSnapshot['pressure']['tier']): number {
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

function pressureBandRank(band: RunStateSnapshot['pressure']['band']): number {
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

function isWithinGhostMarkerWindow(
  snapshot: RunStateSnapshot,
  definitionId: string,
): boolean {
  return snapshot.cards.ghostMarkers.some((marker) => {
    if (Math.abs(marker.tick - snapshot.tick) > GHOST_MARKER_WINDOW_TICKS) {
      return false;
    }

    if (marker.cardId === null) {
      return true;
    }

    return marker.cardId === definitionId;
  });
}

function currentTeamContextSize(snapshot: RunStateSnapshot): number {
  return Math.max(
    countKeys(snapshot.modeState.roleAssignments),
    countKeys(snapshot.modeState.trustScores),
  );
}

function getExclusiveWindows(
  snapshot: RunStateSnapshot,
): readonly RuntimeDecisionWindowSnapshot[] {
  const windows = Object.values(snapshot.timers.activeDecisionWindows ?? {}).filter(
    (window) => !window.consumed && window.exclusive,
  );

  return windows.length > 0 ? windows : NO_WINDOWS;
}

function matchesExclusiveWindow(
  card: CardInstance,
  window: RuntimeDecisionWindowSnapshot,
): boolean {
  if (window.cardInstanceId && window.cardInstanceId === card.instanceId) {
    return true;
  }

  return card.timingClass.includes(window.timingClass);
}

function buildPassSummary(card: CardInstance): string {
  return `Card ${card.definitionId} is legal.`;
}

// ═════════════════════════════════════════════════════════════════════════════
// Card legality service
// ═════════════════════════════════════════════════════════════════════════════

export class CardLegalityService {
  private readonly overlay = new CardOverlayResolver();

  private readonly timing = new CardTimingValidator();

  private readonly targeting = new CardTargetingResolver();

  public constructor(private readonly registry: CardRegistry) {}

  // ──────────────────────────────────────────────────────────────────────────
  // Primary public APIs
  // ──────────────────────────────────────────────────────────────────────────

  public mustResolve(
    snapshot: RunStateSnapshot,
    definitionId: string,
    target: Targeting,
  ): CardInstance {
    return this.mustResolveForActor(
      snapshot,
      definitionId,
      target,
      snapshot.userId,
    );
  }

  public mustResolveForActor(
    snapshot: RunStateSnapshot,
    definitionId: string,
    target: Targeting,
    actorId: string,
  ): CardInstance {
    const report = this.evaluateForActor(snapshot, definitionId, target, {
      actorId,
      allowSynthetic: false,
    });

    if (!report.legal || !report.selectedCard) {
      throw new Error(
        `Card ${definitionId} is not legal for actor ${actorId} targeting ${target}. ${report.summary}`,
      );
    }

    return report.selectedCard;
  }

  public evaluate(
    snapshot: RunStateSnapshot,
    definitionId: string,
    target: Targeting,
  ): CardLegalityReport {
    return this.evaluateForActor(snapshot, definitionId, target, {
      actorId: snapshot.userId,
      allowSynthetic: false,
    });
  }

  public evaluateForActor(
    snapshot: RunStateSnapshot,
    definitionId: string,
    target: Targeting,
    options: CardLegalityOptions = {},
  ): CardLegalityReport {
    const actorId = options.actorId ?? snapshot.userId;
    const allowSynthetic = options.allowSynthetic ?? false;

    const base = this.registry.get(definitionId);
    if (!base) {
      return Object.freeze({
        definitionId,
        actorId,
        requestedTarget: target,
        mode: snapshot.mode,
        legal: false,
        selectedCard: null,
        selectedInstanceId: null,
        syntheticReference: null,
        candidateReports: NO_CANDIDATES,
        summary: `Unknown card definition: ${definitionId}.`,
      });
    }

    const syntheticReference = this.overlay.resolve(snapshot, base);
    const handCandidates = snapshot.cards.hand.filter(
      (card) => card.definitionId === definitionId,
    );

    const candidatePool = handCandidates.length > 0
      ? handCandidates.map((card) => ({
          card,
          origin: 'HAND' as const,
        }))
      : allowSynthetic
        ? [
            {
              card: syntheticReference,
              origin: 'SYNTHETIC' as const,
            },
          ]
        : [];

    const candidateReports = candidatePool.map((candidate) =>
      this.evaluateCandidate(
        snapshot,
        base,
        candidate.card,
        candidate.origin,
        target,
        actorId,
        syntheticReference,
        allowSynthetic,
      ),
    );

    if (candidateReports.length === 0) {
      return Object.freeze({
        definitionId,
        actorId,
        requestedTarget: target,
        mode: snapshot.mode,
        legal: false,
        selectedCard: null,
        selectedInstanceId: null,
        syntheticReference,
        candidateReports: NO_CANDIDATES,
        summary: `Card ${definitionId} is not in hand for actor ${actorId}.`,
      });
    }

    const selected = candidateReports.find((candidate) => candidate.legal) ?? null;

    return Object.freeze({
      definitionId,
      actorId,
      requestedTarget: target,
      mode: snapshot.mode,
      legal: selected !== null,
      selectedCard: selected?.card ?? null,
      selectedInstanceId: selected?.instanceId ?? null,
      syntheticReference,
      candidateReports: Object.freeze([...candidateReports]),
      summary:
        selected?.summary ??
        candidateReports.map((candidate) => candidate.summary).join(' '),
    });
  }

  public canResolve(
    snapshot: RunStateSnapshot,
    definitionId: string,
    target: Targeting,
  ): boolean {
    return this.evaluate(snapshot, definitionId, target).legal;
  }

  public quoteResources(
    snapshot: RunStateSnapshot,
    definitionId: string,
    target: Targeting,
  ): CardResourceQuote {
    const definition = this.registry.require(definitionId);
    const card = this.overlay.resolve(snapshot, definition);
    return this.buildResourceQuote(snapshot, definition, card, target);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Candidate evaluation pipeline
  // ──────────────────────────────────────────────────────────────────────────

  private evaluateCandidate(
    snapshot: RunStateSnapshot,
    base: CardDefinition,
    candidate: CardInstance,
    origin: 'HAND' | 'SYNTHETIC',
    target: Targeting,
    actorId: string,
    syntheticReference: CardInstance,
    allowSynthetic: boolean,
  ): CardCandidateLegalityReport {
    const checks: CardLegalityCheck[] = [];

    this.pushLookupChecks(snapshot, base, checks);
    this.pushHandChecks(snapshot, candidate, origin, allowSynthetic, checks);
    this.pushOverlayChecks(snapshot, base, checks);
    this.pushInstanceConsistencyChecks(
      snapshot,
      candidate,
      syntheticReference,
      checks,
    );

    const legalTimings = this.timing.legalTimings(snapshot, candidate);
    this.pushTimingChecks(snapshot, candidate, legalTimings, checks);
    this.pushTargetingChecks(snapshot, candidate, target, checks);
    this.pushDecisionWindowChecks(snapshot, candidate, checks);

    const resourceQuote = this.buildResourceQuote(
      snapshot,
      base,
      candidate,
      target,
    );
    this.pushResourceChecks(resourceQuote, checks);

    this.pushModeRuleChecks(snapshot, base, candidate, target, actorId, checks);
    this.pushSpecialRuleChecks(snapshot, base, candidate, target, checks);

    const legal = checks.every((check) => check.passed);
    const summary = legal
      ? buildPassSummary(candidate)
      : summarizeChecks(checks, `Card ${candidate.definitionId} is not legal.`);

    return Object.freeze({
      instanceId: candidate.instanceId,
      origin,
      card: candidate,
      legal,
      legalTimings: Object.freeze([...legalTimings]),
      resourceQuote,
      checks: Object.freeze([...checks]),
      summary,
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Lookup and base doctrine checks
  // ──────────────────────────────────────────────────────────────────────────

  private pushLookupChecks(
    snapshot: RunStateSnapshot,
    base: CardDefinition,
    checks: CardLegalityCheck[],
  ): void {
    checks.push(
      buildCheck(
        'LOOKUP',
        true,
        `Card ${base.id} exists in the registry.`,
        {
          mode: snapshot.mode,
          deckType: base.deckType,
          baseCost: base.baseCost,
        },
      ),
    );

    const baseModeLegal = base.modeLegal.includes(snapshot.mode);
    checks.push(
      buildCheck(
        'LOOKUP',
        baseModeLegal,
        baseModeLegal
          ? `Card ${base.id} is legal in base mode ${snapshot.mode}.`
          : `Card ${base.id} is not legal in mode ${snapshot.mode}.`,
        {
          mode: snapshot.mode,
          modeLegal: Object.freeze([...base.modeLegal]),
        },
        baseModeLegal ? 'PASS' : 'CARD_DEFINITION_MODE_ILLEGAL',
      ),
    );
  }

  private pushHandChecks(
    snapshot: RunStateSnapshot,
    candidate: CardInstance,
    origin: 'HAND' | 'SYNTHETIC',
    allowSynthetic: boolean,
    checks: CardLegalityCheck[],
  ): void {
    const handSatisfied = origin === 'HAND' || allowSynthetic;

    checks.push(
      buildCheck(
        'HAND',
        handSatisfied,
        origin === 'HAND'
          ? `Card ${candidate.definitionId} is present in hand.`
          : allowSynthetic
            ? `Card ${candidate.definitionId} is being evaluated through an allowed synthetic reference.`
            : `Card ${candidate.definitionId} is not present in hand.`,
        {
          handSize: snapshot.cards.hand.length,
          origin,
          instanceId: candidate.instanceId,
          allowSynthetic,
        },
        handSatisfied ? 'PASS' : 'CARD_NOT_IN_HAND',
      ),
    );

    const decayOk = candidate.decayTicksRemaining === null || candidate.decayTicksRemaining > 0;

    checks.push(
      buildCheck(
        'HAND',
        decayOk,
        decayOk
          ? `Card ${candidate.definitionId} has usable decay state.`
          : `Card ${candidate.definitionId} has expired decay and cannot be played.`,
        {
          decayTicksRemaining: candidate.decayTicksRemaining,
        },
        decayOk ? 'PASS' : 'INSTANCE_DECAY_EXPIRED',
      ),
    );
  }

  private pushOverlayChecks(
    snapshot: RunStateSnapshot,
    base: CardDefinition,
    checks: CardLegalityCheck[],
  ): void {
    const overlay = base.modeOverlay?.[snapshot.mode];
    const overlayLegal = overlay?.legal !== false;

    checks.push(
      buildCheck(
        'OVERLAY',
        overlayLegal,
        overlayLegal
          ? `Overlay allows ${base.id} in mode ${snapshot.mode}.`
          : `Overlay disables ${base.id} in mode ${snapshot.mode}.`,
        {
          mode: snapshot.mode,
          costModifier: overlay?.costModifier ?? null,
          effectModifier: overlay?.effectModifier ?? null,
          targetingOverride: overlay?.targetingOverride ?? null,
          timingLock: overlay?.timingLock ?? LAST_DETAIL_EMPTY,
        },
        overlayLegal ? 'PASS' : 'CARD_OVERLAY_DISABLED',
      ),
    );
  }

  private pushInstanceConsistencyChecks(
    snapshot: RunStateSnapshot,
    candidate: CardInstance,
    canonical: CardInstance,
    checks: CardLegalityCheck[],
  ): void {
    const modeAligned = candidate.overlayAppliedForMode === snapshot.mode;
    checks.push(
      buildCheck(
        'INSTANCE',
        modeAligned,
        modeAligned
          ? `Card instance ${candidate.instanceId} is aligned to mode ${snapshot.mode}.`
          : `Card instance ${candidate.instanceId} was materialized for mode ${candidate.overlayAppliedForMode}, not ${snapshot.mode}.`,
        {
          candidateMode: candidate.overlayAppliedForMode,
          snapshotMode: snapshot.mode,
        },
        modeAligned ? 'PASS' : 'INSTANCE_MODE_DRIFT',
      ),
    );

    const costAligned = candidate.cost === canonical.cost;
    checks.push(
      buildCheck(
        'INSTANCE',
        costAligned,
        costAligned
          ? `Card ${candidate.definitionId} cost matches backend overlay materialization.`
          : `Card ${candidate.definitionId} cost drift detected.`,
        {
          candidateCost: candidate.cost,
          canonicalCost: canonical.cost,
        },
        costAligned ? 'PASS' : 'INSTANCE_COST_DRIFT',
      ),
    );

    const targetingAligned = candidate.targeting === canonical.targeting;
    checks.push(
      buildCheck(
        'INSTANCE',
        targetingAligned,
        targetingAligned
          ? `Card ${candidate.definitionId} targeting matches backend overlay materialization.`
          : `Card ${candidate.definitionId} targeting drift detected.`,
        {
          candidateTargeting: candidate.targeting,
          canonicalTargeting: canonical.targeting,
        },
        targetingAligned ? 'PASS' : 'INSTANCE_TARGETING_DRIFT',
      ),
    );

    const timingAligned = setEquals(
      uniqueTimingClasses(candidate.timingClass),
      uniqueTimingClasses(canonical.timingClass),
    );
    checks.push(
      buildCheck(
        'INSTANCE',
        timingAligned,
        timingAligned
          ? `Card ${candidate.definitionId} timing classes match backend overlay materialization.`
          : `Card ${candidate.definitionId} timing drift detected.`,
        {
          candidateTiming: Object.freeze([...candidate.timingClass]),
          canonicalTiming: Object.freeze([...canonical.timingClass]),
        },
        timingAligned ? 'PASS' : 'INSTANCE_TIMING_DRIFT',
      ),
    );

    const tagsAligned = compareWeightedTags(candidate.tags, canonical.tags);
    checks.push(
      buildCheck(
        'INSTANCE',
        tagsAligned,
        tagsAligned
          ? `Card ${candidate.definitionId} tags match backend overlay materialization.`
          : `Card ${candidate.definitionId} tag drift detected.`,
        {
          candidateTags: Object.freeze([...candidate.tags]),
          canonicalTags: Object.freeze([...canonical.tags]),
        },
        tagsAligned ? 'PASS' : 'INSTANCE_TAG_DRIFT',
      ),
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Timing, targeting, and exclusive windows
  // ──────────────────────────────────────────────────────────────────────────

  private pushTimingChecks(
    snapshot: RunStateSnapshot,
    card: CardInstance,
    legalTimings: readonly TimingClass[],
    checks: CardLegalityCheck[],
  ): void {
    const timingLegal = legalTimings.length > 0;
    checks.push(
      buildCheck(
        'TIMING',
        timingLegal,
        timingLegal
          ? `Card ${card.definitionId} is legal in timing windows: ${joinOrNone(legalTimings)}.`
          : `Card ${card.definitionId} is not legal in the current timing window.`,
        {
          candidateTiming: Object.freeze([...card.timingClass]),
          legalTimings: Object.freeze([...legalTimings]),
          phase: snapshot.phase,
          tick: snapshot.tick,
        },
        timingLegal ? 'PASS' : 'TIMING_WINDOW_ILLEGAL',
      ),
    );
  }

  private pushTargetingChecks(
    snapshot: RunStateSnapshot,
    card: CardInstance,
    target: Targeting,
    checks: CardLegalityCheck[],
  ): void {
    const targetLegal = this.targeting.isAllowed(snapshot, card, target);
    checks.push(
      buildCheck(
        'TARGETING',
        targetLegal,
        targetLegal
          ? `Card ${card.definitionId} can target ${target}.`
          : `Card ${card.definitionId} cannot target ${target}.`,
        {
          requestedTarget: target,
          intrinsicTargeting: card.targeting,
          mode: snapshot.mode,
        },
        targetLegal ? 'PASS' : 'TARGETING_ILLEGAL',
      ),
    );
  }

  private pushDecisionWindowChecks(
    snapshot: RunStateSnapshot,
    card: CardInstance,
    checks: CardLegalityCheck[],
  ): void {
    const exclusiveWindows = getExclusiveWindows(snapshot);
    if (exclusiveWindows.length === 0) {
      checks.push(
        buildCheck(
          'DECISION_WINDOWS',
          true,
          'No exclusive decision window is blocking this card.',
          {
            activeExclusiveWindows: 0,
          },
        ),
      );
      return;
    }

    const matching = exclusiveWindows.filter((window) =>
      matchesExclusiveWindow(card, window),
    );

    const blocked = matching.length === 0;
    checks.push(
      buildCheck(
        'DECISION_WINDOWS',
        !blocked,
        blocked
          ? `Card ${card.definitionId} is blocked by an unrelated exclusive decision window.`
          : `Card ${card.definitionId} is permitted by the active exclusive decision window set.`,
        {
          activeExclusiveWindows: exclusiveWindows.length,
          matchingWindowIds: Object.freeze(matching.map((window) => window.id)),
          activeWindowIds: Object.freeze(exclusiveWindows.map((window) => window.id)),
        },
        blocked ? 'EXCLUSIVE_WINDOW_BLOCKED' : 'PASS',
      ),
    );

    if (matching.length > 0) {
      const window = matching[0];
      const modeAligned = window.mode === snapshot.mode;
      checks.push(
        buildCheck(
          'DECISION_WINDOWS',
          modeAligned,
          modeAligned
            ? `Exclusive window ${window.id} mode matches snapshot mode.`
            : `Exclusive window ${window.id} mode ${window.mode} does not match snapshot mode ${snapshot.mode}.`,
          {
            windowId: window.id,
            windowMode: window.mode,
            snapshotMode: snapshot.mode,
          },
          modeAligned ? 'PASS' : 'EXCLUSIVE_WINDOW_MISMATCH',
        ),
      );
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Resource-lane legality
  // ──────────────────────────────────────────────────────────────────────────

  private buildResourceQuote(
    snapshot: RunStateSnapshot,
    base: CardDefinition,
    card: CardInstance,
    target: Targeting,
  ): CardResourceQuote {
    const requirements: CardLegalityRequirement[] = [];
    const spendLane = resolveSpendLane(snapshot, base, target);

    if (spendLane === 'CASH') {
      requirements.push(
        buildRequirement(
          'CASH',
          'Cash',
          card.cost,
          snapshot.economy.cash,
          'card.cost',
        ),
      );
    } else if (spendLane === 'BATTLE_BUDGET') {
      requirements.push(
        buildRequirement(
          'BATTLE_BUDGET',
          'Battle Budget',
          card.cost,
          snapshot.battle.battleBudget,
          'card.cost',
        ),
      );
    } else if (spendLane === 'SHARED_TREASURY') {
      requirements.push(
        buildRequirement(
          'SHARED_TREASURY',
          'Shared Treasury',
          card.cost,
          snapshot.modeState.sharedTreasuryBalance,
          'card.cost',
        ),
      );
    }

    const holdChargeCost = resolveHoldChargeCost(base);
    if (holdChargeCost > 0) {
      requirements.push(
        buildRequirement(
          'HOLD_CHARGE',
          'Hold Charges',
          holdChargeCost,
          snapshot.timers.holdCharges,
          'baseEffect.holdChargeDelta / hold tags',
        ),
      );
    }

    const counterIntelCost = resolveCounterIntelCost(base);
    if (counterIntelCost > 0) {
      requirements.push(
        buildRequirement(
          'COUNTER_INTEL',
          'Counter Intel Tier',
          counterIntelCost,
          snapshot.modeState.counterIntelTier,
          'baseEffect.counterIntelDelta / counter-intel tags',
        ),
      );
    }

    return Object.freeze({
      spendLane,
      requirements: requirements.length > 0
        ? Object.freeze([...requirements])
        : NO_REQUIREMENTS,
      affordable: requirements.every((requirement) => requirement.satisfied),
    });
  }

  private pushResourceChecks(
    quote: CardResourceQuote,
    checks: CardLegalityCheck[],
  ): void {
    if (quote.requirements.length === 0) {
      checks.push(
        buildCheck(
          'RESOURCE_LANES',
          true,
          'Card has no costed resource requirements.',
          {
            spendLane: quote.spendLane,
          },
        ),
      );
      return;
    }

    checks.push(
      buildCheck(
        'RESOURCE_LANES',
        quote.affordable,
        quote.affordable
          ? `Resource requirements are satisfied through ${quote.spendLane}.`
          : `Resource requirements are not satisfied through ${quote.spendLane}.`,
        {
          spendLane: quote.spendLane,
          requirementKinds: Object.freeze(
            quote.requirements.map((requirement) => requirement.kind),
          ),
        },
        quote.affordable ? 'PASS' : this.resolvePrimaryResourceFailureCode(quote),
      ),
    );

    for (const requirement of quote.requirements) {
      checks.push(
        buildCheck(
          'RESOURCE_LANES',
          requirement.satisfied,
          requirement.satisfied
            ? `${requirement.label} requirement satisfied.`
            : `${requirement.label} requirement not satisfied. Required ${requirement.required}, available ${requirement.available}.`,
          {
            kind: requirement.kind,
            required: requirement.required,
            available: requirement.available,
            source: requirement.source,
          },
          requirement.satisfied
            ? 'PASS'
            : this.resolveRequirementFailureCode(requirement.kind),
        ),
      );
    }
  }

  private resolvePrimaryResourceFailureCode(
    quote: CardResourceQuote,
  ): CardLegalityFailureCode {
    const firstFailed = quote.requirements.find((requirement) => !requirement.satisfied);

    if (!firstFailed) {
      return 'SPECIAL_RULE_VIOLATION';
    }

    return this.resolveRequirementFailureCode(firstFailed.kind);
  }

  private resolveRequirementFailureCode(
    kind: CardRequirementKind,
  ): CardLegalityFailureCode {
    switch (kind) {
      case 'CASH':
        return 'INSUFFICIENT_CASH';
      case 'BATTLE_BUDGET':
        return 'INSUFFICIENT_BATTLE_BUDGET';
      case 'SHARED_TREASURY':
        return 'INSUFFICIENT_SHARED_TREASURY';
      case 'HOLD_CHARGE':
        return 'INSUFFICIENT_HOLD_CHARGES';
      case 'COUNTER_INTEL':
        return 'INSUFFICIENT_COUNTER_INTEL';
      default:
        return 'SPECIAL_RULE_VIOLATION';
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Mode-native doctrine checks
  // ──────────────────────────────────────────────────────────────────────────

  private pushModeRuleChecks(
    snapshot: RunStateSnapshot,
    base: CardDefinition,
    card: CardInstance,
    target: Targeting,
    actorId: string,
    checks: CardLegalityCheck[],
  ): void {
    switch (snapshot.mode) {
      case 'solo':
        this.pushSoloRuleChecks(snapshot, base, card, checks);
        break;
      case 'pvp':
        this.pushPvpRuleChecks(snapshot, base, card, target, checks);
        break;
      case 'coop':
        this.pushCoopRuleChecks(snapshot, base, card, target, actorId, checks);
        break;
      case 'ghost':
        this.pushGhostRuleChecks(snapshot, base, card, checks);
        break;
      default:
        checks.push(
          buildCheck(
            'MODE_RULES',
            false,
            `Mode ${snapshot.mode} is unsupported by legality evaluation.`,
            {
              mode: snapshot.mode,
            },
            'SPECIAL_RULE_VIOLATION',
          ),
        );
        break;
    }
  }

  private pushSoloRuleChecks(
    snapshot: RunStateSnapshot,
    base: CardDefinition,
    card: CardInstance,
    checks: CardLegalityCheck[],
  ): void {
    const holdChargeCost = resolveHoldChargeCost(base);
    if (holdChargeCost > 0 || hasSemanticTag(card, 'hold')) {
      const holdEnabled = snapshot.modeState.holdEnabled;
      checks.push(
        buildCheck(
          'MODE_RULES',
          holdEnabled,
          holdEnabled
            ? 'Hold-system card is allowed because the hold system is enabled.'
            : 'Hold-system card is illegal because the hold system is disabled.',
          {
            holdEnabled: snapshot.modeState.holdEnabled,
            holdCharges: snapshot.timers.holdCharges,
          },
          holdEnabled ? 'PASS' : 'HOLD_SYSTEM_DISABLED',
        ),
      );
    }

    if (card.timingClass.includes('PHZ')) {
      const phaseWindowAvailable = snapshot.modeState.phaseBoundaryWindowsRemaining > 0;
      checks.push(
        buildCheck(
          'MODE_RULES',
          phaseWindowAvailable,
          phaseWindowAvailable
            ? 'Phase-boundary card is inside an active phase-boundary window.'
            : 'Phase-boundary card requires a remaining phase-boundary window.',
          {
            phaseBoundaryWindowsRemaining:
              snapshot.modeState.phaseBoundaryWindowsRemaining,
            phase: snapshot.phase,
          },
          phaseWindowAvailable ? 'PASS' : 'PHASE_BOUNDARY_REQUIRED',
        ),
      );
    }
  }

  private pushPvpRuleChecks(
    snapshot: RunStateSnapshot,
    base: CardDefinition,
    card: CardInstance,
    target: Targeting,
    checks: CardLegalityCheck[],
  ): void {
    const inPvp = snapshot.mode === 'pvp';
    checks.push(
      buildCheck(
        'MODE_RULES',
        inPvp,
        inPvp
          ? 'PvP doctrine context is active.'
          : 'Card requires PvP doctrine context.',
        {
          mode: snapshot.mode,
          deckType: base.deckType,
        },
        inPvp ? 'PASS' : 'PVP_CONTEXT_REQUIRED',
      ),
    );

    if (COUNTER_ANCHORED_DECKS.has(base.deckType) || card.timingClass.includes('CTR')) {
      const counterContext =
        snapshot.battle.pendingAttacks.length > 0 ||
        snapshot.modeState.counterIntelTier > 0;

      checks.push(
        buildCheck(
          'MODE_RULES',
          counterContext,
          counterContext
            ? 'Counter doctrine context is active.'
            : 'Counter card requires an active counter window or counter-intel context.',
          {
            pendingAttacks: snapshot.battle.pendingAttacks.length,
            counterIntelTier: snapshot.modeState.counterIntelTier,
          },
          counterContext ? 'PASS' : 'COUNTER_WINDOW_REQUIRED',
        ),
      );
    }

    if (BATTLE_BUDGET_DECKS.has(base.deckType)) {
      const targetDoctrineValid = target === 'OPPONENT' || target === 'GLOBAL';
      checks.push(
        buildCheck(
          'MODE_RULES',
          targetDoctrineValid,
          targetDoctrineValid
            ? `PvP combat deck ${base.deckType} is aimed at a legal competitive target.`
            : `PvP combat deck ${base.deckType} must target OPPONENT or GLOBAL.`,
          {
            deckType: base.deckType,
            requestedTarget: target,
          },
          targetDoctrineValid ? 'PASS' : 'TARGETING_ILLEGAL',
        ),
      );
    }
  }

  private pushCoopRuleChecks(
    snapshot: RunStateSnapshot,
    base: CardDefinition,
    card: CardInstance,
    target: Targeting,
    actorId: string,
    checks: CardLegalityCheck[],
  ): void {
    const inCoop = snapshot.mode === 'coop';
    checks.push(
      buildCheck(
        'MODE_RULES',
        inCoop,
        inCoop
          ? 'Coop doctrine context is active.'
          : 'Card requires coop doctrine context.',
        {
          mode: snapshot.mode,
          deckType: base.deckType,
        },
        inCoop ? 'PASS' : 'COOP_CONTEXT_REQUIRED',
      ),
    );

    if (TEAM_TARGETS.has(target)) {
      const teamContextReady = currentTeamContextSize(snapshot) >= MIN_TEAM_CONTEXT_SIZE;
      checks.push(
        buildCheck(
          'MODE_RULES',
          teamContextReady,
          teamContextReady
            ? 'Team-target context is present.'
            : 'Team-target card requires coop role or trust context.',
          {
            roleAssignments: countKeys(snapshot.modeState.roleAssignments),
            trustScoreEntries: countKeys(snapshot.modeState.trustScores),
            requestedTarget: target,
          },
          teamContextReady ? 'PASS' : 'TEAM_CONTEXT_REQUIRED',
        ),
      );
    }

    if (AID_ANCHORED_DECKS.has(base.deckType) || card.timingClass.includes('AID')) {
      const aidContext =
        snapshot.modeState.sharedTreasury ||
        countKeys(snapshot.modeState.roleAssignments) > 0;

      checks.push(
        buildCheck(
          'MODE_RULES',
          aidContext,
          aidContext
            ? 'Aid doctrine context is active.'
            : 'Aid card requires shared-treasury or role-assignment context.',
          {
            sharedTreasury: snapshot.modeState.sharedTreasury,
            roleAssignments: countKeys(snapshot.modeState.roleAssignments),
          },
          aidContext ? 'PASS' : 'AID_CONTEXT_REQUIRED',
        ),
      );
    }

    if (RESCUE_ANCHORED_DECKS.has(base.deckType) || card.timingClass.includes('RES')) {
      const rescueContext =
        snapshot.modeState.bleedMode ||
        snapshot.modeState.sharedTreasuryBalance <= 0 ||
        Object.values(snapshot.modeState.trustScores).some((score) => score < 35);

      checks.push(
        buildCheck(
          'MODE_RULES',
          rescueContext,
          rescueContext
            ? 'Rescue doctrine context is active.'
            : 'Rescue card requires bleed, treasury stress, or trust stress.',
          {
            bleedMode: snapshot.modeState.bleedMode,
            sharedTreasuryBalance: snapshot.modeState.sharedTreasuryBalance,
            trustScores: Object.freeze(
              Object.values(snapshot.modeState.trustScores).map((score) => String(score)),
            ),
          },
          rescueContext ? 'PASS' : 'RESCUE_WINDOW_REQUIRED',
        ),
      );
    }

    if (isDefectionCard(base.id)) {
      this.pushDefectionChecks(snapshot, base.id, actorId, checks);
    }
  }

  private pushGhostRuleChecks(
    snapshot: RunStateSnapshot,
    base: CardDefinition,
    card: CardInstance,
    checks: CardLegalityCheck[],
  ): void {
    const inGhost = snapshot.mode === 'ghost';
    checks.push(
      buildCheck(
        'MODE_RULES',
        inGhost,
        inGhost
          ? 'Ghost doctrine context is active.'
          : 'Card requires ghost doctrine context.',
        {
          mode: snapshot.mode,
          deckType: base.deckType,
        },
        inGhost ? 'PASS' : 'GHOST_CONTEXT_REQUIRED',
      ),
    );

    if (GHOST_ANCHORED_DECKS.has(base.deckType) || card.timingClass.includes('GBM')) {
      const markersEnabled = snapshot.modeState.legendMarkersEnabled;
      checks.push(
        buildCheck(
          'MODE_RULES',
          markersEnabled,
          markersEnabled
            ? 'Legend markers are enabled.'
            : 'Ghost card requires legend markers to be enabled.',
          {
            legendMarkersEnabled: snapshot.modeState.legendMarkersEnabled,
          },
          markersEnabled ? 'PASS' : 'GHOST_MARKERS_DISABLED',
        ),
      );

      const baselinePresent = Boolean(snapshot.modeState.ghostBaselineRunId);
      checks.push(
        buildCheck(
          'MODE_RULES',
          baselinePresent,
          baselinePresent
            ? 'Ghost baseline run is present.'
            : 'Ghost card requires a baseline legend run.',
          {
            ghostBaselineRunId: snapshot.modeState.ghostBaselineRunId,
          },
          baselinePresent ? 'PASS' : 'GHOST_BASELINE_REQUIRED',
        ),
      );

      const markerDataPresent =
        snapshot.cards.ghostMarkers.length > 0 &&
        isWithinGhostMarkerWindow(snapshot, base.id);
      checks.push(
        buildCheck(
          'MODE_RULES',
          markerDataPresent,
          markerDataPresent
            ? 'Ghost marker data is present for this card window.'
            : 'Ghost card requires nearby legend marker data.',
          {
            ghostMarkerCount: snapshot.cards.ghostMarkers.length,
            tick: snapshot.tick,
            definitionId: base.id,
          },
          markerDataPresent ? 'PASS' : 'GHOST_MARKER_DATA_REQUIRED',
        ),
      );
    }
  }

  private pushDefectionChecks(
    snapshot: RunStateSnapshot,
    definitionId: string,
    actorId: string,
    checks: CardLegalityCheck[],
  ): void {
    const coopOnly = snapshot.mode === 'coop';
    checks.push(
      buildCheck(
        'MODE_RULES',
        coopOnly,
        coopOnly
          ? `Defection card ${definitionId} is in coop mode.`
          : `Defection card ${definitionId} is only legal in coop mode.`,
        {
          mode: snapshot.mode,
        },
        coopOnly ? 'PASS' : 'DEFECTION_MODE_REQUIRED',
      ),
    );

    const expectedStep = resolveDefectionStep(definitionId);
    const currentStep = snapshot.modeState.defectionStepByPlayer[actorId] ?? 0;
    const inSequence = expectedStep === null || expectedStep === currentStep + 1;

    checks.push(
      buildCheck(
        'MODE_RULES',
        inSequence,
        inSequence
          ? `Defection sequence is valid for actor ${actorId}.`
          : `Defection card ${definitionId} is out of sequence for actor ${actorId}. Current step ${currentStep}.`,
        {
          actorId,
          currentStep,
          expectedStep,
        },
        inSequence ? 'PASS' : 'DEFECTION_SEQUENCE_BROKEN',
      ),
    );

    if (definitionId === SPECIAL_CARD_IDS.ASSET_SEIZURE) {
      const sharedTreasury = snapshot.modeState.sharedTreasury;
      checks.push(
        buildCheck(
          'MODE_RULES',
          sharedTreasury,
          sharedTreasury
            ? 'Asset Seizure has shared treasury context.'
            : 'Asset Seizure requires shared treasury context.',
          {
            sharedTreasury: snapshot.modeState.sharedTreasury,
            sharedTreasuryBalance: snapshot.modeState.sharedTreasuryBalance,
          },
          sharedTreasury ? 'PASS' : 'SHARED_TREASURY_REQUIRED',
        ),
      );
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Card-specific and doctrine-anchor checks
  // ──────────────────────────────────────────────────────────────────────────

  private pushSpecialRuleChecks(
    snapshot: RunStateSnapshot,
    base: CardDefinition,
    card: CardInstance,
    target: Targeting,
    checks: CardLegalityCheck[],
  ): void {
    if (card.definitionId === SPECIAL_CARD_IDS.SYSTEMIC_OVERRIDE) {
      const globalOnly = card.targeting === 'GLOBAL' && target === 'GLOBAL';
      checks.push(
        buildCheck(
          'SPECIAL_RULES',
          globalOnly,
          globalOnly
            ? 'Systemic Override resolves as a GLOBAL effect.'
            : 'Systemic Override must resolve as a GLOBAL effect.',
          {
            intrinsicTargeting: card.targeting,
            requestedTarget: target,
          },
          globalOnly ? 'PASS' : 'SYSTEMIC_OVERRIDE_TARGET_INVALID',
        ),
      );
    }

    if (card.definitionId === SPECIAL_CARD_IDS.CASCADE_BREAK) {
      const hasCascadeContext = snapshot.cascade.activeChains.length > 0;
      checks.push(
        buildCheck(
          'SPECIAL_RULES',
          hasCascadeContext,
          hasCascadeContext
            ? 'Cascade Break has active cascade context.'
            : 'Cascade Break requires at least one active cascade chain.',
          {
            activeChains: snapshot.cascade.activeChains.length,
          },
          hasCascadeContext ? 'PASS' : 'CASCADE_CONTEXT_REQUIRED',
        ),
      );
    }

    if (card.definitionId === SPECIAL_CARD_IDS.TIME_DEBT_PAID) {
      const remainingMs =
        snapshot.timers.seasonBudgetMs +
        snapshot.timers.extensionBudgetMs -
        snapshot.timers.elapsedMs;
      const endWindow = remainingMs <= END_WINDOW_MS;

      checks.push(
        buildCheck(
          'SPECIAL_RULES',
          endWindow,
          endWindow
            ? 'Time Debt Paid is within the end-window doctrine.'
            : 'Time Debt Paid requires the end-window doctrine.',
          {
            remainingMs,
            endWindowMs: END_WINDOW_MS,
          },
          endWindow ? 'PASS' : 'END_WINDOW_REQUIRED',
        ),
      );
    }

    if (card.timingClass.includes('PHZ')) {
      const phaseBoundary = snapshot.modeState.phaseBoundaryWindowsRemaining > 0;
      checks.push(
        buildCheck(
          'SPECIAL_RULES',
          phaseBoundary,
          phaseBoundary
            ? 'Phase-boundary doctrine is active.'
            : 'Card requires a phase-boundary doctrine window.',
          {
            phaseBoundaryWindowsRemaining:
              snapshot.modeState.phaseBoundaryWindowsRemaining,
          },
          phaseBoundary ? 'PASS' : 'PHASE_BOUNDARY_REQUIRED',
        ),
      );
    }

    if (card.timingClass.includes('PSK')) {
      const pressureSpike =
        pressureRank(snapshot.pressure.tier) >
          pressureRank(snapshot.pressure.previousTier) ||
        pressureBandRank(snapshot.pressure.band) >
          pressureBandRank(snapshot.pressure.previousBand);

      checks.push(
        buildCheck(
          'SPECIAL_RULES',
          pressureSpike,
          pressureSpike
            ? 'Pressure-spike doctrine is active.'
            : 'Card requires a pressure-spike doctrine window.',
          {
            currentTier: snapshot.pressure.tier,
            previousTier: snapshot.pressure.previousTier,
            currentBand: snapshot.pressure.band,
            previousBand: snapshot.pressure.previousBand,
          },
          pressureSpike ? 'PASS' : 'PRESSURE_SPIKE_REQUIRED',
        ),
      );
    }

    if (isSharedObjectiveCard(base)) {
      const sharedObjectiveContext =
        snapshot.mode === 'coop' &&
        snapshot.modeState.sharedTreasury &&
        (target === 'TEAM' || target === 'GLOBAL');

      checks.push(
        buildCheck(
          'SPECIAL_RULES',
          sharedObjectiveContext,
          sharedObjectiveContext
            ? 'Shared-objective card has syndicate objective context.'
            : 'Shared-objective card requires coop shared-treasury team/global context.',
          {
            mode: snapshot.mode,
            sharedTreasury: snapshot.modeState.sharedTreasury,
            requestedTarget: target,
          },
          sharedObjectiveContext ? 'PASS' : 'SPECIAL_RULE_VIOLATION',
        ),
      );
    }
  }
}
