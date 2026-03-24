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

  // ─── Batch Evaluation ──────────────────────────────────────────────────────

  /**
   * Evaluate multiple card+target pairs in a single call.
   * Returns a batch report with per-card reports and aggregate stats.
   * Used by the AI planner, test harnesses, and the UX "hand state" system.
   */
  public evaluateBatch(
    snapshot: RunStateSnapshot,
    requests: readonly { readonly definitionId: string; readonly target: Targeting }[],
    options: CardLegalityOptions = {},
  ): CardLegalityBatchReport {
    const reports = requests.map((req) =>
      this.evaluateForActor(snapshot, req.definitionId, req.target, options),
    );

    const legalCount = reports.filter((r) => r.legal).length;
    const illegalCount = reports.length - legalCount;

    return Object.freeze({
      mode: snapshot.mode,
      actorId: options.actorId ?? snapshot.userId,
      totalEvaluated: reports.length,
      legalCount,
      illegalCount,
      reports: Object.freeze(reports),
      allLegal: illegalCount === 0,
      noneLegal: legalCount === 0,
      summary: `${legalCount}/${reports.length} legal`,
    });
  }

  /**
   * Filter a list of definition IDs to only those currently playable
   * against the supplied target. Returns playable IDs in registry order.
   */
  public filterPlayableCards(
    snapshot: RunStateSnapshot,
    definitionIds: readonly string[],
    target: Targeting,
    options: CardLegalityOptions = {},
  ): readonly string[] {
    return definitionIds.filter((id) => {
      const report = this.evaluateForActor(snapshot, id, target, options);
      return report.legal;
    });
  }

  // ─── Hand Summary ──────────────────────────────────────────────────────────

  /**
   * Build a comprehensive summary of the entire legal state of a hand.
   * The UX "hand overlay" system calls this once per tick to compute which
   * cards are highlighted, dimmed, urgent, or blocked.
   */
  public buildLegalHandSummary(
    snapshot: RunStateSnapshot,
    hand: readonly { readonly definitionId: string; readonly target: Targeting }[],
    options: CardLegalityOptions = {},
  ): LegalHandSummary {
    const reports = this.evaluateBatch(snapshot, hand, options);

    const playableIds: string[] = [];
    const blockedIds: string[] = [];
    const urgentIds: string[] = [];

    for (const report of reports.reports) {
      if (report.legal) {
        playableIds.push(report.definitionId);
        const urgency = this.classifyReportUrgency(snapshot, report);
        if (urgency === 'CRITICAL' || urgency === 'HIGH') {
          urgentIds.push(report.definitionId);
        }
      } else {
        blockedIds.push(report.definitionId);
      }
    }

    const playableRatio01 = round4(
      playableIds.length / Math.max(1, hand.length),
    );

    const handIsFullyBlocked = playableIds.length === 0 && hand.length > 0;
    const handIsFullyOpen = blockedIds.length === 0 && hand.length > 0;

    return Object.freeze({
      mode: snapshot.mode,
      actorId: options.actorId ?? snapshot.userId,
      handSize: hand.length,
      playableCount: playableIds.length,
      blockedCount: blockedIds.length,
      urgentCount: urgentIds.length,
      playableIds: Object.freeze(playableIds),
      blockedIds: Object.freeze(blockedIds),
      urgentIds: Object.freeze(urgentIds),
      playableRatio01,
      handIsFullyBlocked,
      handIsFullyOpen,
      summary: handIsFullyBlocked
        ? `Hand fully blocked — no legal plays available (${hand.length} cards).`
        : handIsFullyOpen
        ? `Hand fully open — all ${hand.length} cards are legal.`
        : `${playableIds.length}/${hand.length} cards playable, ${urgentIds.length} urgent.`,
    });
  }

  /**
   * Count playable cards in a hand for a given target.
   * Lightweight version of buildLegalHandSummary for quick checks.
   */
  public resolvePlayableCount(
    snapshot: RunStateSnapshot,
    hand: readonly { readonly definitionId: string; readonly target: Targeting }[],
    options: CardLegalityOptions = {},
  ): number {
    return hand.filter((h) =>
      this.evaluateForActor(snapshot, h.definitionId, h.target, options).legal,
    ).length;
  }

  // ─── Window Advisory ──────────────────────────────────────────────────────

  /**
   * Build a timing-window advisory for a card.
   * Tells the UI exactly which windows are open and what the player needs to
   * do to unlock blocked timing classes — feeds NPC hint commentary.
   */
  public buildWindowAdvisory(
    snapshot: RunStateSnapshot,
    definitionId: string,
    target: Targeting,
    options: CardLegalityOptions = {},
  ): CardWindowAdvisory {
    const report = this.evaluateForActor(snapshot, definitionId, target, options);
    const base = this.registry.get(definitionId);

    const timingCheck = report.candidateReports
      .flatMap((r) => r.checks)
      .find((c) => c.stage === 'TIMING');

    const targetingCheck = report.candidateReports
      .flatMap((r) => r.checks)
      .find((c) => c.stage === 'TARGETING');

    const resourceCheck = report.candidateReports
      .flatMap((r) => r.checks)
      .find((c) => c.stage === 'RESOURCE_LANES' && !c.passed);

    const windowBlocked =
      (timingCheck && !timingCheck.passed) ? timingCheck.message : null;

    const targetingBlocked =
      (targetingCheck && !targetingCheck.passed) ? targetingCheck.message : null;

    const resourceBlocked =
      resourceCheck ? resourceCheck.message : null;

    const legalTimings = report.candidateReports
      .flatMap((r) => r.legalTimings);
    const uniqueLegalTimings = [...new Set(legalTimings)];

    return Object.freeze({
      definitionId,
      mode: snapshot.mode,
      isLegal: report.legal,
      windowBlocked,
      targetingBlocked,
      resourceBlocked,
      legalTimings: Object.freeze(uniqueLegalTimings),
      deckType: base?.deckType ?? null,
      advisoryText: buildWindowAdvisoryText(report, windowBlocked, targetingBlocked, resourceBlocked),
    });
  }

  // ─── UX Card State ─────────────────────────────────────────────────────────

  /**
   * Build the complete UX card state for a single card.
   * The frontend card component renders directly from this — no additional
   * legality checks are needed on the client side.
   */
  public buildUXCardState(
    snapshot: RunStateSnapshot,
    definitionId: string,
    target: Targeting,
    options: CardLegalityOptions = {},
  ): CardUXState {
    const report = this.evaluateForActor(snapshot, definitionId, target, options);
    const base = this.registry.get(definitionId);

    const urgency = this.classifyReportUrgency(snapshot, report);
    const spendLane = base
      ? resolveSpendLane(snapshot, base, target)
      : ('NONE' as CardSpendLane);

    const resourceQuote =
      report.selectedCard
        ? (report.candidateReports.find(
            (r) => r.instanceId === report.selectedInstanceId,
          )?.resourceQuote ?? null)
        : null;

    const blockingCheck = report.candidateReports
      .flatMap((r) => r.checks)
      .find((c) => !c.passed) ?? null;

    const effectLabel = base
      ? summarizeEffectPayloadForLegality(base.baseEffect)
      : 'unknown effect';

    return Object.freeze({
      definitionId,
      mode: snapshot.mode,
      isLegal: report.legal,
      urgency,
      spendLane,
      resourceQuote: resourceQuote ?? null,
      blockingStage: blockingCheck?.stage ?? null,
      blockingCode: blockingCheck?.code ?? null,
      blockingMessage: blockingCheck?.message ?? null,
      effectLabel,
      legalTimings: Object.freeze(
        report.candidateReports.flatMap((r) => r.legalTimings),
      ),
      summary: report.summary,
    });
  }

  /**
   * Build UX card states for an entire hand in one call.
   * Returns a map from definitionId → UXState.
   */
  public buildHandUXStates(
    snapshot: RunStateSnapshot,
    hand: readonly { readonly definitionId: string; readonly target: Targeting }[],
    options: CardLegalityOptions = {},
  ): ReadonlyMap<string, CardUXState> {
    const map = new Map<string, CardUXState>();
    for (const { definitionId, target } of hand) {
      map.set(definitionId, this.buildUXCardState(snapshot, definitionId, target, options));
    }
    return map;
  }

  // ─── Urgency Classification ────────────────────────────────────────────────

  /**
   * Classify a card's urgency level for the current snapshot.
   * Urgency drives the UX priority ring, audio cues, and NPC hint triggers.
   */
  public classifyCardUrgency(
    snapshot: RunStateSnapshot,
    definitionId: string,
    target: Targeting,
    options: CardLegalityOptions = {},
  ): CardUrgencyLevel {
    const report = this.evaluateForActor(snapshot, definitionId, target, options);
    return this.classifyReportUrgency(snapshot, report);
  }

  private classifyReportUrgency(
    snapshot: RunStateSnapshot,
    report: CardLegalityReport,
  ): CardUrgencyLevel {
    if (!report.legal) return 'BLOCKED';

    const base = this.registry.get(report.definitionId);
    if (!base) return 'LOW';

    // Rescue deck card + teammate in critical pressure → CRITICAL
    if (
      RESCUE_ANCHORED_DECKS.has(base.deckType) &&
      snapshot.mode === 'coop'
    ) {
      const pressureRankValue = pressureRank(snapshot.pressure.tier);
      if (pressureRankValue >= 3) return 'CRITICAL';
    }

    // Counter deck card + active counter window → CRITICAL
    if (
      COUNTER_ANCHORED_DECKS.has(base.deckType) &&
      report.candidateReports.some((r) =>
        r.legalTimings.includes('CTR'),
      )
    ) {
      return 'CRITICAL';
    }

    // Ghost deck + ghost baseline exists → HIGH
    if (
      GHOST_ANCHORED_DECKS.has(base.deckType) &&
      snapshot.mode === 'ghost'
    ) {
      return 'HIGH';
    }

    // Pressure is elevated and card is response-type → HIGH
    const pressureRankValue = pressureRank(snapshot.pressure.tier);
    if (pressureRankValue >= 2 && (base.deckType === 'FUBAR' || base.deckType === 'SO')) {
      return 'HIGH';
    }

    // Battle deck + pvp mode → MEDIUM
    if (BATTLE_BUDGET_DECKS.has(base.deckType) && snapshot.mode === 'pvp') {
      return 'MEDIUM';
    }

    return 'LOW';
  }

  // ─── Diagnostic Report ────────────────────────────────────────────────────

  /**
   * Generate a full diagnostic report for a card evaluation.
   * Used by the debug panel, AI planner explain-mode, and test assertions.
   */
  public diagnosticReport(
    snapshot: RunStateSnapshot,
    definitionId: string,
    target: Targeting,
    options: CardLegalityOptions = {},
  ): CardLegalityDiagnosticReport {
    const report = this.evaluateForActor(snapshot, definitionId, target, options);
    const base = this.registry.get(definitionId);
    const urgency = this.classifyReportUrgency(snapshot, report);
    const uxState = this.buildUXCardState(snapshot, definitionId, target, options);
    const windowAdvisory = this.buildWindowAdvisory(snapshot, definitionId, target, options);

    const allChecks = report.candidateReports.flatMap((r) => r.checks);
    const failedChecks = allChecks.filter((c) => !c.passed);
    const passedChecks = allChecks.filter((c) => c.passed);

    const defectionStep = isDefectionCard(definitionId)
      ? resolveDefectionStep(definitionId)
      : null;

    const effectLabel = base
      ? summarizeEffectPayloadForLegality(base.baseEffect)
      : 'unknown';

    return Object.freeze({
      definitionId,
      actorId: options.actorId ?? snapshot.userId,
      mode: snapshot.mode,
      target,
      isLegal: report.legal,
      urgency,
      uxState,
      windowAdvisory,
      report,
      candidateCount: report.candidateReports.length,
      passedCheckCount: passedChecks.length,
      failedCheckCount: failedChecks.length,
      failedChecks: Object.freeze(failedChecks),
      defectionStep,
      effectLabel,
      deckType: base?.deckType ?? null,
      healthy: report.legal && failedChecks.length === 0,
      summary: [
        `${definitionId}@${snapshot.mode} → ${target}`,
        `legal=${report.legal}`,
        `urgency=${urgency}`,
        `checks=${passedChecks.length}/${allChecks.length}`,
        `candidates=${report.candidateReports.length}`,
      ].join(' '),
    });
  }

  /**
   * Run diagnostics for a full hand at once.
   */
  public batchDiagnosticReport(
    snapshot: RunStateSnapshot,
    hand: readonly { readonly definitionId: string; readonly target: Targeting }[],
    options: CardLegalityOptions = {},
  ): CardLegalityBatchDiagnosticReport {
    const reports = hand.map((h) =>
      this.diagnosticReport(snapshot, h.definitionId, h.target, options),
    );

    const legalReports = reports.filter((r) => r.isLegal);
    const blockedReports = reports.filter((r) => !r.isLegal);
    const urgentReports = reports.filter(
      (r) => r.urgency === 'CRITICAL' || r.urgency === 'HIGH',
    );

    return Object.freeze({
      mode: snapshot.mode,
      actorId: options.actorId ?? snapshot.userId,
      handSize: hand.length,
      legalCount: legalReports.length,
      blockedCount: blockedReports.length,
      urgentCount: urgentReports.length,
      reports: Object.freeze(reports),
      allLegal: blockedReports.length === 0,
      noneLegal: legalReports.length === 0,
      summary: `${legalReports.length}/${reports.length} legal — ${urgentReports.length} urgent`,
    });
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Exported types for new public APIs
// ═════════════════════════════════════════════════════════════════════════════

export type CardUrgencyLevel = 'BLOCKED' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface LegalHandSummary {
  readonly mode: ModeCode;
  readonly actorId: string;
  readonly handSize: number;
  readonly playableCount: number;
  readonly blockedCount: number;
  readonly urgentCount: number;
  readonly playableIds: readonly string[];
  readonly blockedIds: readonly string[];
  readonly urgentIds: readonly string[];
  readonly playableRatio01: number;
  readonly handIsFullyBlocked: boolean;
  readonly handIsFullyOpen: boolean;
  readonly summary: string;
}

export interface CardWindowAdvisory {
  readonly definitionId: string;
  readonly mode: ModeCode;
  readonly isLegal: boolean;
  readonly windowBlocked: string | null;
  readonly targetingBlocked: string | null;
  readonly resourceBlocked: string | null;
  readonly legalTimings: readonly TimingClass[];
  readonly deckType: DeckType | null;
  readonly advisoryText: string;
}

export interface CardUXState {
  readonly definitionId: string;
  readonly mode: ModeCode;
  readonly isLegal: boolean;
  readonly urgency: CardUrgencyLevel;
  readonly spendLane: CardSpendLane;
  readonly resourceQuote: CardResourceQuote | null;
  readonly blockingStage: CardLegalityStage | null;
  readonly blockingCode: CardLegalityFailureCode | 'PASS' | null;
  readonly blockingMessage: string | null;
  readonly effectLabel: string;
  readonly legalTimings: readonly TimingClass[];
  readonly summary: string;
}

export interface CardLegalityBatchReport {
  readonly mode: ModeCode;
  readonly actorId: string;
  readonly totalEvaluated: number;
  readonly legalCount: number;
  readonly illegalCount: number;
  readonly reports: readonly CardLegalityReport[];
  readonly allLegal: boolean;
  readonly noneLegal: boolean;
  readonly summary: string;
}

export interface CardLegalityDiagnosticReport {
  readonly definitionId: string;
  readonly actorId: string;
  readonly mode: ModeCode;
  readonly target: Targeting;
  readonly isLegal: boolean;
  readonly urgency: CardUrgencyLevel;
  readonly uxState: CardUXState;
  readonly windowAdvisory: CardWindowAdvisory;
  readonly report: CardLegalityReport;
  readonly candidateCount: number;
  readonly passedCheckCount: number;
  readonly failedCheckCount: number;
  readonly failedChecks: readonly CardLegalityCheck[];
  readonly defectionStep: 1 | 2 | 3 | null;
  readonly effectLabel: string;
  readonly deckType: DeckType | null;
  readonly healthy: boolean;
  readonly summary: string;
}

export interface CardLegalityBatchDiagnosticReport {
  readonly mode: ModeCode;
  readonly actorId: string;
  readonly handSize: number;
  readonly legalCount: number;
  readonly blockedCount: number;
  readonly urgentCount: number;
  readonly reports: readonly CardLegalityDiagnosticReport[];
  readonly allLegal: boolean;
  readonly noneLegal: boolean;
  readonly summary: string;
}

// ═════════════════════════════════════════════════════════════════════════════
// Module-level utility functions (use all imported types)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Build a human-readable summary of an EffectPayload for legality context.
 * Used by buildUXCardState and diagnosticReport to label the card's effect
 * without requiring the compiler to be available.
 */
export function summarizeEffectPayloadForLegality(payload: EffectPayload): string {
  const parts: string[] = [];

  if (payload.cashDelta != null && payload.cashDelta !== 0) {
    parts.push(`${payload.cashDelta >= 0 ? '+' : ''}${payload.cashDelta} cash`);
  }
  if (payload.incomeDelta != null && payload.incomeDelta !== 0) {
    parts.push(`${payload.incomeDelta >= 0 ? '+' : ''}${payload.incomeDelta} income`);
  }
  if (payload.shieldDelta != null && payload.shieldDelta !== 0) {
    parts.push(`${payload.shieldDelta >= 0 ? '+' : ''}${payload.shieldDelta} shield`);
  }
  if (payload.heatDelta != null && payload.heatDelta !== 0) {
    parts.push(`${payload.heatDelta >= 0 ? '+' : ''}${payload.heatDelta} heat`);
  }
  if (payload.trustDelta != null && payload.trustDelta !== 0) {
    parts.push(`${payload.trustDelta >= 0 ? '+' : ''}${payload.trustDelta} trust`);
  }
  if (payload.timeDeltaMs != null && payload.timeDeltaMs !== 0) {
    parts.push(`${payload.timeDeltaMs >= 0 ? '+' : ''}${payload.timeDeltaMs}ms time`);
  }
  if (payload.divergenceDelta != null && payload.divergenceDelta !== 0) {
    parts.push(`${payload.divergenceDelta >= 0 ? '+' : ''}${payload.divergenceDelta} divergence`);
  }
  if (payload.debtDelta != null && payload.debtDelta !== 0) {
    parts.push(`${payload.debtDelta >= 0 ? '+' : ''}${payload.debtDelta} debt [deferred]`);
  }
  if (payload.treasuryDelta != null && payload.treasuryDelta !== 0) {
    parts.push(`${payload.treasuryDelta >= 0 ? '+' : ''}${payload.treasuryDelta} treasury [deferred]`);
  }
  if (payload.battleBudgetDelta != null && payload.battleBudgetDelta !== 0) {
    parts.push(`${payload.battleBudgetDelta >= 0 ? '+' : ''}${payload.battleBudgetDelta} battle budget [deferred]`);
  }
  if (payload.injectCards && payload.injectCards.length > 0) {
    parts.push(`inject [${payload.injectCards.slice(0, 3).join(', ')}${payload.injectCards.length > 3 ? '…' : ''}]`);
  }
  if (payload.grantBadges && payload.grantBadges.length > 0) {
    parts.push(`grant badges [${payload.grantBadges.join(', ')}]`);
  }
  if (payload.namedActionId) {
    parts.push(`action:${payload.namedActionId}`);
  }

  return parts.length > 0 ? parts.join(' | ') : 'no quantified effects';
}

/**
 * Check whether an EffectPayload will require battle budget spending.
 * Used by legality pre-screening before a full evaluation.
 */
export function effectPayloadRequiresBattleBudget(payload: EffectPayload): boolean {
  return (payload.battleBudgetDelta ?? 0) < 0;
}

/**
 * Check whether an EffectPayload will require shared treasury access.
 */
export function effectPayloadRequiresSharedTreasury(payload: EffectPayload): boolean {
  return (
    (payload.treasuryDelta ?? 0) < 0 ||
    payload.namedActionId === 'shared-treasury-spend'
  );
}

/**
 * Compute the net cash impact of an EffectPayload.
 * Positive = player gains cash. Negative = player spends cash.
 */
export function effectPayloadNetCashImpact(payload: EffectPayload): number {
  return (payload.cashDelta ?? 0) - Math.abs(payload.debtDelta ?? 0);
}

/**
 * Check whether an EffectPayload has any resource-spending side effects
 * that require a legality resource lane check.
 */
export function effectPayloadHasResourceSpend(payload: EffectPayload): boolean {
  return (
    (payload.cashDelta ?? 0) < 0 ||
    (payload.battleBudgetDelta ?? 0) < 0 ||
    (payload.treasuryDelta ?? 0) < 0 ||
    (payload.holdChargeDelta ?? 0) < 0 ||
    (payload.counterIntelDelta ?? 0) < 0
  );
}

/**
 * Build the advisory text for a window advisory object.
 */
function buildWindowAdvisoryText(
  report: CardLegalityReport,
  windowBlocked: string | null,
  targetingBlocked: string | null,
  resourceBlocked: string | null,
): string {
  if (report.legal) {
    return `${report.definitionId} is legal — play is available.`;
  }

  const reasons: string[] = [];
  if (windowBlocked) reasons.push(`Timing: ${windowBlocked}`);
  if (targetingBlocked) reasons.push(`Targeting: ${targetingBlocked}`);
  if (resourceBlocked) reasons.push(`Resources: ${resourceBlocked}`);

  if (reasons.length > 0) {
    return `${report.definitionId} is blocked — ${reasons.join(' | ')}`;
  }

  return `${report.definitionId} is blocked — ${report.summary}`;
}

/**
 * Classify the urgency label text for UI display.
 */
export function cardUrgencyLevelLabel(urgency: CardUrgencyLevel): string {
  switch (urgency) {
    case 'CRITICAL': return 'Play immediately — critical window closing.';
    case 'HIGH': return 'High-value play available — act soon.';
    case 'MEDIUM': return 'Situational play — consider timing.';
    case 'LOW': return 'Available when ready.';
    case 'BLOCKED': return 'Card is not currently legal.';
  }
}

/**
 * Return the CSS accent class for an urgency level.
 * Matches the design system token names used in the UX layer.
 */
export function cardUrgencyAccentClass(urgency: CardUrgencyLevel): string {
  switch (urgency) {
    case 'CRITICAL': return 'urgency-critical';
    case 'HIGH': return 'urgency-high';
    case 'MEDIUM': return 'urgency-medium';
    case 'LOW': return 'urgency-low';
    case 'BLOCKED': return 'urgency-blocked';
  }
}

/**
 * Check whether a CardLegalityReport failed at a specific stage.
 */
export function reportFailedAtStage(
  report: CardLegalityReport,
  stage: CardLegalityStage,
): boolean {
  return report.candidateReports
    .flatMap((r) => r.checks)
    .some((c) => c.stage === stage && !c.passed);
}

/**
 * Get the first failing stage name from a report.
 * UI uses this to display a concise "blocked at: TIMING" label.
 */
export function reportFirstFailingStage(
  report: CardLegalityReport,
): CardLegalityStage | null {
  for (const candidate of report.candidateReports) {
    for (const check of candidate.checks) {
      if (!check.passed) return check.stage;
    }
  }
  return null;
}

/**
 * Get the first failing code from a report.
 */
export function reportFirstFailingCode(
  report: CardLegalityReport,
): CardLegalityFailureCode | null {
  for (const candidate of report.candidateReports) {
    for (const check of candidate.checks) {
      if (!check.passed && check.code !== 'PASS') {
        return check.code as CardLegalityFailureCode;
      }
    }
  }
  return null;
}

/**
 * Check whether a batch report has any critical urgency cards.
 */
export function batchReportHasCriticalUrgency(
  report: CardLegalityBatchDiagnosticReport,
): boolean {
  return report.reports.some((r) => r.urgency === 'CRITICAL');
}

/**
 * Extract all unique blocking stages from a batch diagnostic report.
 */
export function batchReportBlockingStages(
  report: CardLegalityBatchDiagnosticReport,
): readonly CardLegalityStage[] {
  const stages = new Set<CardLegalityStage>();
  for (const r of report.reports) {
    if (r.uxState.blockingStage) {
      stages.add(r.uxState.blockingStage);
    }
  }
  return Object.freeze([...stages]);
}

/**
 * List all deck types that consume battle budget.
 */
export function listBattleBudgetDeckTypes(): readonly DeckType[] {
  return Object.freeze([...BATTLE_BUDGET_DECKS]);
}

/**
 * List all deck types anchored to ghost mechanics.
 */
export function listGhostAnchoredDeckTypes(): readonly DeckType[] {
  return Object.freeze([...GHOST_ANCHORED_DECKS]);
}

/**
 * List all deck types anchored to rescue mechanics.
 */
export function listRescueAnchoredDeckTypes(): readonly DeckType[] {
  return Object.freeze([...RESCUE_ANCHORED_DECKS]);
}

/**
 * List all deck types anchored to counter mechanics.
 */
export function listCounterAnchoredDeckTypes(): readonly DeckType[] {
  return Object.freeze([...COUNTER_ANCHORED_DECKS]);
}

/**
 * List all deck types anchored to aid mechanics.
 */
export function listAidAnchoredDeckTypes(): readonly DeckType[] {
  return Object.freeze([...AID_ANCHORED_DECKS]);
}

/**
 * List the defection sequence card IDs in play order.
 */
export function listDefectionSequenceIds(): readonly string[] {
  return Object.freeze([
    SPECIAL_CARD_IDS.BREAK_PACT,
    SPECIAL_CARD_IDS.SILENT_EXIT,
    SPECIAL_CARD_IDS.ASSET_SEIZURE,
  ]);
}

/**
 * Check whether a definition ID is a special system card.
 */
export function isSpecialCardId(definitionId: string): boolean {
  return Object.values(SPECIAL_CARD_IDS).includes(
    definitionId as typeof SPECIAL_CARD_IDS[keyof typeof SPECIAL_CARD_IDS],
  );
}

/**
 * Get the timing window end-of-run threshold in ms.
 */
export function getEndWindowThresholdMs(): number {
  return END_WINDOW_MS;
}

/**
 * Get the ghost marker timing window in ticks.
 */
export function getGhostMarkerWindowTicks(): number {
  return GHOST_MARKER_WINDOW_TICKS;
}

// ═════════════════════════════════════════════════════════════════════════════
// Module Authority Object
// ═════════════════════════════════════════════════════════════════════════════

export const CARD_LEGALITY_SERVICE_MODULE_ID =
  'backend.engine.cards.CardLegalityService' as const;
export const CARD_LEGALITY_SERVICE_MODULE_VERSION = '2.0.0' as const;

export const CARD_LEGALITY_SERVICE_MODULE_AUTHORITY = Object.freeze({
  moduleId: CARD_LEGALITY_SERVICE_MODULE_ID,
  version: CARD_LEGALITY_SERVICE_MODULE_VERSION,

  // Core class
  CardLegalityService: 'class',

  // Exported types (compile-time only)
  CardLegalityStage: 'type',
  CardLegalityFailureCode: 'type',
  CardRequirementKind: 'type',
  CardSpendLane: 'type',
  CardLegalityDetailValue: 'type',
  CardLegalityDetails: 'type',
  CardLegalityCheck: 'interface',
  CardLegalityRequirement: 'interface',
  CardResourceQuote: 'interface',
  CardCandidateLegalityReport: 'interface',
  CardLegalityReport: 'interface',
  CardLegalityOptions: 'interface',
  CardUrgencyLevel: 'type',
  LegalHandSummary: 'interface',
  CardWindowAdvisory: 'interface',
  CardUXState: 'interface',
  CardLegalityBatchReport: 'interface',
  CardLegalityDiagnosticReport: 'interface',
  CardLegalityBatchDiagnosticReport: 'interface',

  // Module constants
  CARD_LEGALITY_SERVICE_MODULE_ID: 'const',
  CARD_LEGALITY_SERVICE_MODULE_VERSION: 'const',
  CARD_LEGALITY_SERVICE_MODULE_AUTHORITY: 'const',

  // Utility functions
  summarizeEffectPayloadForLegality: 'function',
  effectPayloadRequiresBattleBudget: 'function',
  effectPayloadRequiresSharedTreasury: 'function',
  effectPayloadNetCashImpact: 'function',
  effectPayloadHasResourceSpend: 'function',
  cardUrgencyLevelLabel: 'function',
  cardUrgencyAccentClass: 'function',
  reportFailedAtStage: 'function',
  reportFirstFailingStage: 'function',
  reportFirstFailingCode: 'function',
  batchReportHasCriticalUrgency: 'function',
  batchReportBlockingStages: 'function',
  listBattleBudgetDeckTypes: 'function',
  listGhostAnchoredDeckTypes: 'function',
  listRescueAnchoredDeckTypes: 'function',
  listCounterAnchoredDeckTypes: 'function',
  listAidAnchoredDeckTypes: 'function',
  listDefectionSequenceIds: 'function',
  isSpecialCardId: 'function',
  getEndWindowThresholdMs: 'function',
  getGhostMarkerWindowTicks: 'function',
} as const);
