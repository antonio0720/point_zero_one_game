
/**
 * ════════════════════════════════════════════════════════════════════════════════
 * POINT ZERO ONE — BACKEND ENGINE CORE
 * /backend/src/game/engine/cards/CardTargetingResolver.ts
 * ------------------------------------------------------------------------------
 * Backend-authoritative target-class resolver for Point Zero One card runtime.
 *
 * Doctrine:
 * - targeting is backend-authoritative
 * - target legality is mode-native, not UI-trusted
 * - mode overlays may mutate the final target class but not the schema
 * - simple enum targeting must still resolve through explicit backend policy
 * - this resolver validates target class, timing gate, and mode-native context
 * - identity selection (which teammate / which opponent) is outside this file
 * - legality must remain deterministic for the same snapshot and card instance
 *
 * Why this file exists:
 * The repo currently models targeting as a compact enum:
 *   SELF | OPPONENT | TEAMMATE | TEAM | GLOBAL
 *
 * That is intentionally narrow, but it is not trivial.
 * The same target class means different things in different modes:
 * - Empire cards treat targeting as capital-allocation posture.
 * - Predator cards treat targeting as weapon direction and counter posture.
 * - Syndicate cards treat targeting as contract and rescue direction.
 * - Phantom cards treat targeting as deterministic replay instrumentation.
 *
 * This resolver therefore does more than compare a matrix row.
 * It computes a deterministic targeting context from the canonical snapshot,
 * applies mode doctrine, deck doctrine, timing doctrine, and lightweight
 * runtime gating, then resolves whether the requested target class is legal.
 *
 * The public API stays backward-compatible:
 *   - isAllowed(snapshot, card, targeting): boolean
 *
 * Additional rich APIs are exposed for legality services, audits, telemetry,
 * chat narration, and future proof-chain surfaces without changing callers.
 * ════════════════════════════════════════════════════════════════════════════════
 */

import type {
  CardInstance,
  DeckType,
  ModeCode,
  Targeting,
  TimingClass,
} from '../core/GamePrimitives';
import type { RunStateSnapshot } from '../core/RunStateSnapshot';

/* ──────────────────────────────────────────────────────────────────────────────
 * Literal domains
 * ──────────────────────────────────────────────────────────────────────────── */

const ALL_TARGETINGS: readonly Targeting[] = Object.freeze([
  'SELF',
  'OPPONENT',
  'TEAMMATE',
  'TEAM',
  'GLOBAL',
] as const);

const EMPTY_TARGETINGS: readonly Targeting[] = Object.freeze([] as readonly Targeting[]);

const SELF_ONLY_TARGETINGS: readonly Targeting[] = Object.freeze([
  'SELF',
] as readonly Targeting[]);

const GLOBAL_ONLY_TARGETINGS: readonly Targeting[] = Object.freeze([
  'GLOBAL',
] as readonly Targeting[]);

const COOP_HELPER_TARGETINGS: readonly Targeting[] = Object.freeze([
  'TEAMMATE',
  'TEAM',
] as readonly Targeting[]);

const PVP_SELF_OR_OPPONENT_TARGETINGS: readonly Targeting[] = Object.freeze([
  'SELF',
  'OPPONENT',
] as readonly Targeting[]);

/* ──────────────────────────────────────────────────────────────────────────────
 * Result / policy types
 * ──────────────────────────────────────────────────────────────────────────── */

export type TargetReasonCode =
  | 'TARGET_SUPPORTED'
  | 'TARGET_NOT_IN_BASE_MODE_MATRIX'
  | 'TARGET_NOT_IN_CARD_CLASS_MATRIX'
  | 'TARGET_NOT_IN_DECK_DOCTRINE'
  | 'TARGET_NOT_IN_TIMING_DOCTRINE'
  | 'TARGET_NOT_IN_TAG_DOCTRINE'
  | 'TARGET_BLOCKED_BY_COUNTER_WINDOW_REQUIREMENT'
  | 'TARGET_BLOCKED_BY_RESCUE_WINDOW_REQUIREMENT'
  | 'TARGET_BLOCKED_BY_AID_WINDOW_REQUIREMENT'
  | 'TARGET_BLOCKED_BY_PHASE_BOUNDARY_REQUIREMENT'
  | 'TARGET_BLOCKED_BY_CASCADE_WINDOW_REQUIREMENT'
  | 'TARGET_BLOCKED_BY_GHOST_MARKER_REQUIREMENT'
  | 'TARGET_BLOCKED_BY_SHARED_TREASURY_REQUIREMENT'
  | 'TARGET_BLOCKED_BY_COOP_CONTEXT_REQUIREMENT'
  | 'TARGET_BLOCKED_BY_PVP_CONTEXT_REQUIREMENT'
  | 'TARGET_BLOCKED_BY_GHOST_CONTEXT_REQUIREMENT'
  | 'TARGET_BLOCKED_BY_EXTRACTION_CONTEXT_REQUIREMENT'
  | 'TARGET_BLOCKED_BY_COUNTER_INTEL_REQUIREMENT'
  | 'TARGET_BLOCKED_BY_DISABLED_BOT_CONTEXT'
  | 'TARGET_BLOCKED_BY_ROLE_LOCK'
  | 'TARGET_BLOCKED_BY_WARNING_QUARANTINE'
  | 'TARGET_BLOCKED_BY_OUTCOME_FINALIZED'
  | 'TARGET_BLOCKED_BY_CARD_STATE'
  | 'TARGET_BLOCKED_BY_REQUEST_CANONICALIZATION'
  | 'TARGET_BLOCKED_BY_CARD_DOCTRINE'
  | 'TARGET_BLOCKED_BY_MODE_DOCTRINE'
  | 'TARGET_BLOCKED_BY_RUNTIME_RULE'
  | 'TARGET_ALLOWED_AFTER_CANONICALIZATION';

export interface TargetWindowState {
  readonly PRE: boolean;
  readonly POST: boolean;
  readonly FATE: boolean;
  readonly CTR: boolean;
  readonly RES: boolean;
  readonly AID: boolean;
  readonly GBM: boolean;
  readonly CAS: boolean;
  readonly PHZ: boolean;
  readonly PSK: boolean;
  readonly END: boolean;
  readonly ANY: boolean;
}

export interface TargetModeContext {
  readonly hasOpponentLane: boolean;
  readonly hasCoopLane: boolean;
  readonly hasGhostLane: boolean;
  readonly hasSharedTreasuryLane: boolean;
  readonly hasLegendLane: boolean;
  readonly hasCounterIntelLane: boolean;
  readonly hasExtractionLane: boolean;
  readonly hasPhaseBoundaryLane: boolean;
  readonly isRuntimeQuarantined: boolean;
}

export interface TargetCardContext {
  readonly deckType: DeckType;
  readonly requested: Targeting;
  readonly canonicalBaseTarget: Targeting;
  readonly allowedByBaseMode: readonly Targeting[];
  readonly allowedByCardClass: readonly Targeting[];
  readonly allowedByDeckDoctrine: readonly Targeting[];
  readonly allowedByTimingDoctrine: readonly Targeting[];
  readonly allowedByTagDoctrine: readonly Targeting[];
  readonly tags: readonly string[];
  readonly timingClass: readonly TimingClass[];
  readonly hasPositiveEconomyEffect: boolean;
  readonly hasNegativeEconomyEffect: boolean;
  readonly hasShieldEffect: boolean;
  readonly hasHeatEffect: boolean;
  readonly hasTrustEffect: boolean;
  readonly hasTreasuryEffect: boolean;
  readonly hasBattleBudgetEffect: boolean;
  readonly hasCounterIntelEffect: boolean;
  readonly hasTimeEffect: boolean;
  readonly hasDivergenceEffect: boolean;
  readonly hasInjectionEffect: boolean;
  readonly hasBadgeEffect: boolean;
  readonly namedActionId: string | null;
}

export interface TargetAllowance {
  readonly allowed: boolean;
  readonly requested: Targeting;
  readonly canonicalRequested: Targeting;
  readonly canonicalCardTarget: Targeting;
  readonly mode: ModeCode;
  readonly reasons: readonly TargetReasonCode[];
  readonly allowedTargets: readonly Targeting[];
  readonly blockedTargets: readonly Targeting[];
  readonly windows: TargetWindowState;
  readonly context: TargetModeContext;
  readonly summary: string;
}

/* ──────────────────────────────────────────────────────────────────────────────
 * Base mode matrix
 * ------------------------------------------------------------------------------
 * This preserves the canonical current behavior surface as the floor:
 * - solo     => self/global only
 * - pvp      => self/opponent/global
 * - coop     => self/teammate/team/global
 * - ghost    => self/global only
 *
 * The rest of the file may narrow those permissions further, but never widen
 * the mode beyond doctrine.
 * ──────────────────────────────────────────────────────────────────────────── */

const TARGET_MATRIX: Readonly<
  Record<ModeCode, Readonly<Record<Targeting, readonly Targeting[]>>>
> = Object.freeze({
  solo: Object.freeze({
    SELF: Object.freeze(['SELF'] as readonly Targeting[]),
    OPPONENT: EMPTY_TARGETINGS,
    TEAMMATE: EMPTY_TARGETINGS,
    TEAM: EMPTY_TARGETINGS,
    GLOBAL: GLOBAL_ONLY_TARGETINGS,
  }),
  pvp: Object.freeze({
    SELF: Object.freeze(['SELF'] as readonly Targeting[]),
    OPPONENT: Object.freeze(['OPPONENT'] as readonly Targeting[]),
    TEAMMATE: EMPTY_TARGETINGS,
    TEAM: EMPTY_TARGETINGS,
    GLOBAL: GLOBAL_ONLY_TARGETINGS,
  }),
  coop: Object.freeze({
    SELF: Object.freeze(['SELF'] as readonly Targeting[]),
    OPPONENT: EMPTY_TARGETINGS,
    TEAMMATE: Object.freeze(['TEAMMATE', 'TEAM'] as readonly Targeting[]),
    TEAM: Object.freeze(['TEAM'] as readonly Targeting[]),
    GLOBAL: GLOBAL_ONLY_TARGETINGS,
  }),
  ghost: Object.freeze({
    SELF: Object.freeze(['SELF'] as readonly Targeting[]),
    OPPONENT: EMPTY_TARGETINGS,
    TEAMMATE: EMPTY_TARGETINGS,
    TEAM: EMPTY_TARGETINGS,
    GLOBAL: GLOBAL_ONLY_TARGETINGS,
  }),
});

/* ──────────────────────────────────────────────────────────────────────────────
 * Deck doctrine
 * ------------------------------------------------------------------------------
 * These policies translate the card bible into target-class doctrine without
 * requiring schema changes.
 *
 * Notes:
 * - OPPORTUNITY / IPA / PRIVILEGED / DISCIPLINE are predominantly self-facing.
 * - SABOTAGE is opponent-facing in Predator.
 * - COUNTER is defensive and therefore self-facing in the current schema.
 * - AID / RESCUE are cooperative instruments.
 * - TRUST can be self-facing (defection arc) or cooperative.
 * - BLUFF is allowed to present pressure outward while sometimes hiding an
 *   inward economic effect; target class remains explicit.
 * - GHOST remains self/global because the legend is replay substrate, not a
 *   live opponent lane.
 * ──────────────────────────────────────────────────────────────────────────── */

const DECK_TARGET_DOCTRINE: Readonly<
  Record<DeckType, Readonly<Record<ModeCode, readonly Targeting[]>>>
> = Object.freeze({
  OPPORTUNITY: Object.freeze({
    solo: Object.freeze(['SELF', 'GLOBAL'] as readonly Targeting[]),
    pvp: Object.freeze(['SELF', 'GLOBAL'] as readonly Targeting[]),
    coop: Object.freeze(['SELF', 'TEAM', 'GLOBAL'] as readonly Targeting[]),
    ghost: Object.freeze(['SELF', 'GLOBAL'] as readonly Targeting[]),
  }),
  IPA: Object.freeze({
    solo: Object.freeze(['SELF', 'GLOBAL'] as readonly Targeting[]),
    pvp: Object.freeze(['SELF', 'GLOBAL'] as readonly Targeting[]),
    coop: Object.freeze(['SELF', 'TEAM', 'GLOBAL'] as readonly Targeting[]),
    ghost: Object.freeze(['SELF', 'GLOBAL'] as readonly Targeting[]),
  }),
  FUBAR: Object.freeze({
    solo: Object.freeze(['SELF', 'GLOBAL'] as readonly Targeting[]),
    pvp: Object.freeze(['SELF', 'OPPONENT', 'GLOBAL'] as readonly Targeting[]),
    coop: Object.freeze(['SELF', 'TEAM', 'GLOBAL'] as readonly Targeting[]),
    ghost: Object.freeze(['SELF', 'GLOBAL'] as readonly Targeting[]),
  }),
  MISSED_OPPORTUNITY: Object.freeze({
    solo: SELF_ONLY_TARGETINGS,
    pvp: SELF_ONLY_TARGETINGS,
    coop: SELF_ONLY_TARGETINGS,
    ghost: SELF_ONLY_TARGETINGS,
  }),
  PRIVILEGED: Object.freeze({
    solo: Object.freeze(['SELF', 'GLOBAL'] as readonly Targeting[]),
    pvp: Object.freeze(['SELF', 'GLOBAL'] as readonly Targeting[]),
    coop: Object.freeze(['SELF', 'TEAM', 'GLOBAL'] as readonly Targeting[]),
    ghost: Object.freeze(['SELF', 'GLOBAL'] as readonly Targeting[]),
  }),
  SO: Object.freeze({
    solo: Object.freeze(['SELF', 'GLOBAL'] as readonly Targeting[]),
    pvp: Object.freeze(['SELF', 'GLOBAL'] as readonly Targeting[]),
    coop: Object.freeze(['SELF', 'TEAM', 'GLOBAL'] as readonly Targeting[]),
    ghost: Object.freeze(['SELF', 'GLOBAL'] as readonly Targeting[]),
  }),
  SABOTAGE: Object.freeze({
    solo: EMPTY_TARGETINGS,
    pvp: Object.freeze(['OPPONENT', 'GLOBAL'] as readonly Targeting[]),
    coop: EMPTY_TARGETINGS,
    ghost: EMPTY_TARGETINGS,
  }),
  COUNTER: Object.freeze({
    solo: EMPTY_TARGETINGS,
    pvp: Object.freeze(['SELF'] as readonly Targeting[]),
    coop: Object.freeze(['TEAMMATE', 'TEAM'] as readonly Targeting[]),
    ghost: EMPTY_TARGETINGS,
  }),
  AID: Object.freeze({
    solo: EMPTY_TARGETINGS,
    pvp: EMPTY_TARGETINGS,
    coop: Object.freeze(['TEAMMATE', 'TEAM', 'GLOBAL'] as readonly Targeting[]),
    ghost: EMPTY_TARGETINGS,
  }),
  RESCUE: Object.freeze({
    solo: EMPTY_TARGETINGS,
    pvp: EMPTY_TARGETINGS,
    coop: Object.freeze(['TEAMMATE', 'TEAM', 'GLOBAL'] as readonly Targeting[]),
    ghost: EMPTY_TARGETINGS,
  }),
  DISCIPLINE: Object.freeze({
    solo: Object.freeze(['SELF'] as readonly Targeting[]),
    pvp: Object.freeze(['SELF'] as readonly Targeting[]),
    coop: Object.freeze(['SELF', 'TEAM'] as readonly Targeting[]),
    ghost: Object.freeze(['SELF'] as readonly Targeting[]),
  }),
  TRUST: Object.freeze({
    solo: EMPTY_TARGETINGS,
    pvp: EMPTY_TARGETINGS,
    coop: Object.freeze(['SELF', 'TEAMMATE', 'TEAM', 'GLOBAL'] as readonly Targeting[]),
    ghost: EMPTY_TARGETINGS,
  }),
  BLUFF: Object.freeze({
    solo: EMPTY_TARGETINGS,
    pvp: Object.freeze(['SELF', 'OPPONENT'] as readonly Targeting[]),
    coop: EMPTY_TARGETINGS,
    ghost: EMPTY_TARGETINGS,
  }),
  GHOST: Object.freeze({
    solo: EMPTY_TARGETINGS,
    pvp: EMPTY_TARGETINGS,
    coop: EMPTY_TARGETINGS,
    ghost: Object.freeze(['SELF', 'GLOBAL'] as readonly Targeting[]),
  }),
});

/* ──────────────────────────────────────────────────────────────────────────────
 * Timing doctrine
 * ------------------------------------------------------------------------------
 * Timing classes do not directly define the target class, but they narrow it.
 *
 * Examples:
 * - CTR cards are defensive reaction instruments.
 * - RES cards are rescue-window instruments.
 * - AID cards are cooperative contract instruments.
 * - GBM cards are legend-marker instruments in ghost mode.
 * - CAS cards exist to break / shape cascades and should remain local/global.
 * - PHZ cards are phase-boundary decisions with macro effects.
 * - ANY is not a permission wildcard; it only means the card may also be played
 *   outside a narrower special window.
 * ──────────────────────────────────────────────────────────────────────────── */

const TIMING_TARGET_DOCTRINE: Readonly<
  Record<TimingClass, Readonly<Record<ModeCode, readonly Targeting[]>>>
> = Object.freeze({
  PRE: Object.freeze({
    solo: Object.freeze(['SELF', 'GLOBAL'] as readonly Targeting[]),
    pvp: Object.freeze(['SELF', 'OPPONENT', 'GLOBAL'] as readonly Targeting[]),
    coop: Object.freeze(['SELF', 'TEAMMATE', 'TEAM', 'GLOBAL'] as readonly Targeting[]),
    ghost: Object.freeze(['SELF', 'GLOBAL'] as readonly Targeting[]),
  }),
  POST: Object.freeze({
    solo: Object.freeze(['SELF', 'GLOBAL'] as readonly Targeting[]),
    pvp: Object.freeze(['SELF', 'OPPONENT', 'GLOBAL'] as readonly Targeting[]),
    coop: Object.freeze(['SELF', 'TEAMMATE', 'TEAM', 'GLOBAL'] as readonly Targeting[]),
    ghost: Object.freeze(['SELF', 'GLOBAL'] as readonly Targeting[]),
  }),
  FATE: Object.freeze({
    solo: Object.freeze(['SELF', 'GLOBAL'] as readonly Targeting[]),
    pvp: Object.freeze(['SELF', 'OPPONENT', 'GLOBAL'] as readonly Targeting[]),
    coop: Object.freeze(['SELF', 'TEAM', 'GLOBAL'] as readonly Targeting[]),
    ghost: Object.freeze(['SELF', 'GLOBAL'] as readonly Targeting[]),
  }),
  CTR: Object.freeze({
    solo: EMPTY_TARGETINGS,
    pvp: Object.freeze(['SELF'] as readonly Targeting[]),
    coop: Object.freeze(['TEAMMATE', 'TEAM'] as readonly Targeting[]),
    ghost: EMPTY_TARGETINGS,
  }),
  RES: Object.freeze({
    solo: EMPTY_TARGETINGS,
    pvp: EMPTY_TARGETINGS,
    coop: Object.freeze(['TEAMMATE', 'TEAM', 'GLOBAL'] as readonly Targeting[]),
    ghost: EMPTY_TARGETINGS,
  }),
  AID: Object.freeze({
    solo: EMPTY_TARGETINGS,
    pvp: EMPTY_TARGETINGS,
    coop: Object.freeze(['TEAMMATE', 'TEAM', 'GLOBAL'] as readonly Targeting[]),
    ghost: EMPTY_TARGETINGS,
  }),
  GBM: Object.freeze({
    solo: EMPTY_TARGETINGS,
    pvp: EMPTY_TARGETINGS,
    coop: EMPTY_TARGETINGS,
    ghost: Object.freeze(['SELF', 'GLOBAL'] as readonly Targeting[]),
  }),
  CAS: Object.freeze({
    solo: Object.freeze(['SELF', 'GLOBAL'] as readonly Targeting[]),
    pvp: Object.freeze(['SELF', 'GLOBAL'] as readonly Targeting[]),
    coop: Object.freeze(['SELF', 'TEAM', 'GLOBAL'] as readonly Targeting[]),
    ghost: Object.freeze(['SELF', 'GLOBAL'] as readonly Targeting[]),
  }),
  PHZ: Object.freeze({
    solo: Object.freeze(['SELF', 'GLOBAL'] as readonly Targeting[]),
    pvp: Object.freeze(['SELF', 'GLOBAL'] as readonly Targeting[]),
    coop: Object.freeze(['SELF', 'TEAM', 'GLOBAL'] as readonly Targeting[]),
    ghost: Object.freeze(['SELF', 'GLOBAL'] as readonly Targeting[]),
  }),
  PSK: Object.freeze({
    solo: Object.freeze(['SELF', 'GLOBAL'] as readonly Targeting[]),
    pvp: Object.freeze(['SELF', 'OPPONENT', 'GLOBAL'] as readonly Targeting[]),
    coop: Object.freeze(['SELF', 'TEAMMATE', 'TEAM', 'GLOBAL'] as readonly Targeting[]),
    ghost: Object.freeze(['SELF', 'GLOBAL'] as readonly Targeting[]),
  }),
  END: Object.freeze({
    solo: Object.freeze(['SELF', 'GLOBAL'] as readonly Targeting[]),
    pvp: Object.freeze(['SELF', 'GLOBAL'] as readonly Targeting[]),
    coop: Object.freeze(['SELF', 'TEAM', 'GLOBAL'] as readonly Targeting[]),
    ghost: Object.freeze(['SELF', 'GLOBAL'] as readonly Targeting[]),
  }),
  ANY: Object.freeze({
    solo: Object.freeze(['SELF', 'GLOBAL'] as readonly Targeting[]),
    pvp: Object.freeze(['SELF', 'OPPONENT', 'GLOBAL'] as readonly Targeting[]),
    coop: Object.freeze(['SELF', 'TEAMMATE', 'TEAM', 'GLOBAL'] as readonly Targeting[]),
    ghost: Object.freeze(['SELF', 'GLOBAL'] as readonly Targeting[]),
  }),
});

/* ──────────────────────────────────────────────────────────────────────────────
 * Tag doctrine
 * ------------------------------------------------------------------------------
 * Tags are not legality by themselves, but they are strong doctrine signals.
 * This table deliberately narrows extreme mismatches, especially when the enum
 * is coarse and the mode overlay did not change target class.
 * ──────────────────────────────────────────────────────────────────────────── */

const TAG_TARGET_DOCTRINE: Readonly<
  Record<string, Readonly<Record<ModeCode, readonly Targeting[]>>>
> = Object.freeze({
  sabotage: Object.freeze({
    solo: EMPTY_TARGETINGS,
    pvp: Object.freeze(['OPPONENT', 'GLOBAL'] as readonly Targeting[]),
    coop: EMPTY_TARGETINGS,
    ghost: EMPTY_TARGETINGS,
  }),
  rescue: Object.freeze({
    solo: EMPTY_TARGETINGS,
    pvp: EMPTY_TARGETINGS,
    coop: Object.freeze(['TEAMMATE', 'TEAM', 'GLOBAL'] as readonly Targeting[]),
    ghost: EMPTY_TARGETINGS,
  }),
  aid: Object.freeze({
    solo: EMPTY_TARGETINGS,
    pvp: EMPTY_TARGETINGS,
    coop: Object.freeze(['TEAMMATE', 'TEAM', 'GLOBAL'] as readonly Targeting[]),
    ghost: EMPTY_TARGETINGS,
  }),
  trust: Object.freeze({
    solo: EMPTY_TARGETINGS,
    pvp: EMPTY_TARGETINGS,
    coop: Object.freeze(['SELF', 'TEAMMATE', 'TEAM', 'GLOBAL'] as readonly Targeting[]),
    ghost: EMPTY_TARGETINGS,
  }),
  divergence: Object.freeze({
    solo: EMPTY_TARGETINGS,
    pvp: EMPTY_TARGETINGS,
    coop: EMPTY_TARGETINGS,
    ghost: Object.freeze(['SELF', 'GLOBAL'] as readonly Targeting[]),
  }),
  precision: Object.freeze({
    solo: Object.freeze(['SELF', 'GLOBAL'] as readonly Targeting[]),
    pvp: Object.freeze(['SELF', 'GLOBAL'] as readonly Targeting[]),
    coop: Object.freeze(['SELF', 'TEAM', 'GLOBAL'] as readonly Targeting[]),
    ghost: Object.freeze(['SELF', 'GLOBAL'] as readonly Targeting[]),
  }),
  variance: Object.freeze({
    solo: Object.freeze(['SELF', 'GLOBAL'] as readonly Targeting[]),
    pvp: PVP_SELF_OR_OPPONENT_TARGETINGS,
    coop: Object.freeze(['SELF', 'TEAM', 'GLOBAL'] as readonly Targeting[]),
    ghost: Object.freeze(['SELF', 'GLOBAL'] as readonly Targeting[]),
  }),
  heat: Object.freeze({
    solo: Object.freeze(['SELF', 'GLOBAL'] as readonly Targeting[]),
    pvp: Object.freeze(['SELF', 'OPPONENT', 'GLOBAL'] as readonly Targeting[]),
    coop: Object.freeze(['SELF', 'TEAM', 'GLOBAL'] as readonly Targeting[]),
    ghost: Object.freeze(['SELF', 'GLOBAL'] as readonly Targeting[]),
  }),
  treasury: Object.freeze({
    solo: EMPTY_TARGETINGS,
    pvp: EMPTY_TARGETINGS,
    coop: Object.freeze(['TEAM', 'GLOBAL'] as readonly Targeting[]),
    ghost: EMPTY_TARGETINGS,
  }),
  counterintel: Object.freeze({
    solo: EMPTY_TARGETINGS,
    pvp: Object.freeze(['SELF'] as readonly Targeting[]),
    coop: Object.freeze(['TEAMMATE', 'TEAM'] as readonly Targeting[]),
    ghost: EMPTY_TARGETINGS,
  }),
  momentum: Object.freeze({
    solo: Object.freeze(['SELF', 'GLOBAL'] as readonly Targeting[]),
    pvp: Object.freeze(['SELF', 'OPPONENT', 'GLOBAL'] as readonly Targeting[]),
    coop: Object.freeze(['SELF', 'TEAM', 'GLOBAL'] as readonly Targeting[]),
    ghost: Object.freeze(['SELF', 'GLOBAL'] as readonly Targeting[]),
  }),
  liquidity: Object.freeze({
    solo: Object.freeze(['SELF', 'GLOBAL'] as readonly Targeting[]),
    pvp: Object.freeze(['SELF', 'GLOBAL'] as readonly Targeting[]),
    coop: Object.freeze(['SELF', 'TEAM', 'GLOBAL'] as readonly Targeting[]),
    ghost: Object.freeze(['SELF', 'GLOBAL'] as readonly Targeting[]),
  }),
  income: Object.freeze({
    solo: Object.freeze(['SELF', 'GLOBAL'] as readonly Targeting[]),
    pvp: Object.freeze(['SELF', 'OPPONENT', 'GLOBAL'] as readonly Targeting[]),
    coop: Object.freeze(['SELF', 'TEAMMATE', 'TEAM', 'GLOBAL'] as readonly Targeting[]),
    ghost: Object.freeze(['SELF', 'GLOBAL'] as readonly Targeting[]),
  }),
  resilience: Object.freeze({
    solo: Object.freeze(['SELF', 'GLOBAL'] as readonly Targeting[]),
    pvp: Object.freeze(['SELF', 'GLOBAL'] as readonly Targeting[]),
    coop: Object.freeze(['SELF', 'TEAMMATE', 'TEAM', 'GLOBAL'] as readonly Targeting[]),
    ghost: Object.freeze(['SELF', 'GLOBAL'] as readonly Targeting[]),
  }),
  scale: Object.freeze({
    solo: Object.freeze(['SELF', 'GLOBAL'] as readonly Targeting[]),
    pvp: Object.freeze(['SELF', 'GLOBAL'] as readonly Targeting[]),
    coop: Object.freeze(['SELF', 'TEAM', 'GLOBAL'] as readonly Targeting[]),
    ghost: Object.freeze(['SELF', 'GLOBAL'] as readonly Targeting[]),
  }),
  bluff: Object.freeze({
    solo: EMPTY_TARGETINGS,
    pvp: PVP_SELF_OR_OPPONENT_TARGETINGS,
    coop: EMPTY_TARGETINGS,
    ghost: EMPTY_TARGETINGS,
  }),
  cascade: Object.freeze({
    solo: Object.freeze(['SELF', 'GLOBAL'] as readonly Targeting[]),
    pvp: Object.freeze(['SELF', 'OPPONENT', 'GLOBAL'] as readonly Targeting[]),
    coop: Object.freeze(['SELF', 'TEAM', 'GLOBAL'] as readonly Targeting[]),
    ghost: Object.freeze(['SELF', 'GLOBAL'] as readonly Targeting[]),
  }),
});

/* ──────────────────────────────────────────────────────────────────────────────
 * Mode narratives / summaries
 * ──────────────────────────────────────────────────────────────────────────── */

const MODE_SUMMARY: Readonly<Record<ModeCode, string>> = Object.freeze({
  solo: 'Empire doctrine prioritizes self/all-system capital-allocation targets.',
  pvp: 'Predator doctrine prioritizes self-defense and opponent-facing pressure.',
  coop: 'Syndicate doctrine prioritizes teammate, team, and contract-rescue targets.',
  ghost: 'Phantom doctrine prioritizes self and legend-system precision targets.',
});

const DECK_SUMMARY: Readonly<Record<DeckType, string>> = Object.freeze({
  OPPORTUNITY: 'Opportunity cards deploy capital into your position or macro-state.',
  IPA: 'IPA cards compound the owner or allied team economy, not a live opponent.',
  FUBAR: 'FUBAR cards express adversity and may land as self, opponent, or global pressure depending mode.',
  MISSED_OPPORTUNITY: 'Missed-opportunity cards are consequence-state cards and remain local.',
  PRIVILEGED: 'Privileged cards are power instruments and may touch self, team, or system scope.',
  SO: 'Systemic obstacle cards convert or break obstacle state at self/team/global scope.',
  SABOTAGE: 'Sabotage cards are outward-facing economic warfare instruments.',
  COUNTER: 'Counter cards are defensive reaction instruments and remain inward-facing.',
  AID: 'Aid cards are contractual cooperative instruments.',
  RESCUE: 'Rescue cards are emergency cooperative instruments.',
  DISCIPLINE: 'Discipline cards reduce variance and stabilize the owner or allied lane.',
  TRUST: 'Trust cards modify cooperative architecture or execute betrayal sequence state.',
  BLUFF: 'Bluff cards project pressure outward while sometimes hiding inward gain.',
  GHOST: 'Ghost cards interact with legend marker / replay substrate rather than a live opponent.',
});

/* ──────────────────────────────────────────────────────────────────────────────
 * Small immutable helpers
 * ──────────────────────────────────────────────────────────────────────────── */

function uniqueTargetings(values: readonly Targeting[]): readonly Targeting[] {
  const seen = new Set<Targeting>();
  const output: Targeting[] = [];

  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    output.push(value);
  }

  return Object.freeze(output);
}

function includesTarget(
  values: readonly Targeting[],
  target: Targeting,
): boolean {
  return values.includes(target);
}

function intersectTargetings(
  left: readonly Targeting[],
  right: readonly Targeting[],
): readonly Targeting[] {
  const rightSet = new Set<Targeting>(right);
  const output: Targeting[] = [];

  for (const value of left) {
    if (rightSet.has(value)) {
      output.push(value);
    }
  }

  return uniqueTargetings(output);
}

function unionTargetings(
  ...lists: readonly (readonly Targeting[])[]
): readonly Targeting[] {
  const output: Targeting[] = [];

  for (const list of lists) {
    for (const value of list) {
      output.push(value);
    }
  }

  return uniqueTargetings(output);
}

function subtractTargetings(
  allowed: readonly Targeting[],
  blocked: readonly Targeting[],
): readonly Targeting[] {
  const blockedSet = new Set<Targeting>(blocked);
  const output: Targeting[] = [];

  for (const value of allowed) {
    if (!blockedSet.has(value)) {
      output.push(value);
    }
  }

  return uniqueTargetings(output);
}

function buildBlockedTargets(
  allowed: readonly Targeting[],
): readonly Targeting[] {
  const allowedSet = new Set<Targeting>(allowed);
  const output: Targeting[] = [];

  for (const value of ALL_TARGETINGS) {
    if (!allowedSet.has(value)) {
      output.push(value);
    }
  }

  return Object.freeze(output);
}

function hasTag(card: CardInstance, tag: string): boolean {
  return card.tags.includes(tag) || card.card.tags.includes(tag);
}

function hasAnyTag(card: CardInstance, tags: readonly string[]): boolean {
  for (const tag of tags) {
    if (hasTag(card, tag)) {
      return true;
    }
  }

  return false;
}

function hasTiming(card: CardInstance, timing: TimingClass): boolean {
  return card.timingClass.includes(timing) || card.card.timingClass.includes(timing);
}

function readWindowState(snapshot: RunStateSnapshot): TargetWindowState {
  const activeWindows = Object.values(snapshot.timers.activeDecisionWindows);
  const has = (timingClass: TimingClass): boolean =>
    activeWindows.some(
      (window) =>
        window.mode === snapshot.mode &&
        window.timingClass === timingClass &&
        window.consumed === false,
    );

  return Object.freeze({
    PRE: has('PRE'),
    POST: has('POST'),
    FATE: has('FATE'),
    CTR: has('CTR'),
    RES: has('RES'),
    AID: has('AID'),
    GBM: has('GBM'),
    CAS: has('CAS'),
    PHZ: has('PHZ'),
    PSK: has('PSK'),
    END: has('END'),
    ANY: true,
  });
}

function buildModeContext(snapshot: RunStateSnapshot): TargetModeContext {
  const trustPlayerCount = Object.keys(snapshot.modeState.trustScores).length;
  const roleCount = Object.keys(snapshot.modeState.roleAssignments).length;
  const defectionActorCount = Object.keys(snapshot.modeState.defectionStepByPlayer).length;
  const hasCoopEvidence =
    snapshot.mode === 'coop' ||
    snapshot.modeState.sharedTreasury ||
    trustPlayerCount > 0 ||
    roleCount > 0 ||
    defectionActorCount > 0;

  const hasOpponentLane =
    snapshot.mode === 'pvp' ||
    snapshot.battle.pendingAttacks.length > 0 ||
    snapshot.modeState.extractionActionsRemaining > 0;

  const hasGhostLane =
    snapshot.mode === 'ghost' ||
    snapshot.modeState.legendMarkersEnabled ||
    snapshot.cards.ghostMarkers.length > 0 ||
    snapshot.modeState.ghostBaselineRunId !== null ||
    snapshot.modeState.legendOwnerUserId !== null;

  const warnings = snapshot.telemetry.warnings;

  return Object.freeze({
    hasOpponentLane,
    hasCoopLane: hasCoopEvidence,
    hasGhostLane,
    hasSharedTreasuryLane:
      snapshot.modeState.sharedTreasury ||
      snapshot.modeState.sharedTreasuryBalance > 0,
    hasLegendLane:
      snapshot.modeState.legendMarkersEnabled ||
      snapshot.cards.ghostMarkers.length > 0,
    hasCounterIntelLane: snapshot.modeState.counterIntelTier > 0,
    hasExtractionLane:
      snapshot.battle.pendingAttacks.length > 0 ||
      snapshot.modeState.extractionActionsRemaining > 0,
    hasPhaseBoundaryLane: snapshot.modeState.phaseBoundaryWindowsRemaining > 0,
    isRuntimeQuarantined:
      warnings.includes('INTEGRITY_QUARANTINE') ||
      warnings.includes('ENGINE_ABORT') ||
      snapshot.sovereignty.integrityStatus === 'QUARANTINED',
  });
}

function buildCardContext(
  snapshot: RunStateSnapshot,
  card: CardInstance,
  requested: Targeting,
): TargetCardContext {
  const deckPolicy = DECK_TARGET_DOCTRINE[card.card.deckType][snapshot.mode];
  const timingPolicy = resolveTimingDoctrine(snapshot.mode, card);
  const tagPolicy = resolveTagDoctrine(snapshot.mode, card);

  const effect = card.card.baseEffect;

  return Object.freeze({
    deckType: card.card.deckType,
    requested,
    canonicalBaseTarget: card.targeting,
    allowedByBaseMode: TARGET_MATRIX[snapshot.mode][card.targeting],
    allowedByCardClass: deriveCardClassAllowedTargets(snapshot, card),
    allowedByDeckDoctrine: deckPolicy,
    allowedByTimingDoctrine: timingPolicy,
    allowedByTagDoctrine: tagPolicy,
    tags: Object.freeze([...card.tags]),
    timingClass: Object.freeze([...card.timingClass]),
    hasPositiveEconomyEffect:
      (effect.cashDelta ?? 0) > 0 ||
      (effect.incomeDelta ?? 0) > 0 ||
      (effect.treasuryDelta ?? 0) > 0 ||
      (effect.battleBudgetDelta ?? 0) > 0,
    hasNegativeEconomyEffect:
      (effect.cashDelta ?? 0) < 0 ||
      (effect.incomeDelta ?? 0) < 0 ||
      (effect.expenseDelta ?? 0) > 0 ||
      (effect.debtDelta ?? 0) > 0,
    hasShieldEffect: (effect.shieldDelta ?? 0) !== 0,
    hasHeatEffect: (effect.heatDelta ?? 0) !== 0,
    hasTrustEffect: (effect.trustDelta ?? 0) !== 0,
    hasTreasuryEffect: (effect.treasuryDelta ?? 0) !== 0,
    hasBattleBudgetEffect: (effect.battleBudgetDelta ?? 0) !== 0,
    hasCounterIntelEffect: (effect.counterIntelDelta ?? 0) !== 0,
    hasTimeEffect: (effect.timeDeltaMs ?? 0) !== 0,
    hasDivergenceEffect: (effect.divergenceDelta ?? 0) !== 0,
    hasInjectionEffect:
      (effect.injectCards?.length ?? 0) > 0 ||
      (effect.exhaustCards?.length ?? 0) > 0,
    hasBadgeEffect: (effect.grantBadges?.length ?? 0) > 0,
    namedActionId: effect.namedActionId ?? null,
  });
}

function resolveTimingDoctrine(
  mode: ModeCode,
  card: CardInstance,
): readonly Targeting[] {
  let policy = ALL_TARGETINGS;

  for (const timingClass of card.timingClass) {
    policy = intersectTargetings(policy, TIMING_TARGET_DOCTRINE[timingClass][mode]);
  }

  return policy;
}

function resolveTagDoctrine(
  mode: ModeCode,
  card: CardInstance,
): readonly Targeting[] {
  const doctrineLists: (readonly Targeting[])[] = [];

  const seen = new Set<string>();
  for (const tag of [...card.card.tags, ...card.tags]) {
    if (seen.has(tag)) {
      continue;
    }
    seen.add(tag);

    const doctrine = TAG_TARGET_DOCTRINE[tag];
    if (!doctrine) {
      continue;
    }
    doctrineLists.push(doctrine[mode]);
  }

  if (doctrineLists.length === 0) {
    return ALL_TARGETINGS;
  }

  let current = ALL_TARGETINGS;
  for (const doctrine of doctrineLists) {
    current = intersectTargetings(current, doctrine);
  }

  return current;
}

/* ──────────────────────────────────────────────────────────────────────────────
 * Card-class allowance derivation
 * ------------------------------------------------------------------------------
 * This intentionally reads the resolved card instance plus its immutable base
 * definition and effect payload. It gives the resolver richer semantics without
 * adding new schema fields.
 * ──────────────────────────────────────────────────────────────────────────── */

function deriveCardClassAllowedTargets(
  snapshot: RunStateSnapshot,
  card: CardInstance,
): readonly Targeting[] {
  const effect = card.card.baseEffect;

  switch (card.card.deckType) {
    case 'SABOTAGE':
      if (snapshot.mode !== 'pvp') {
        return EMPTY_TARGETINGS;
      }

      if (
        hasAnyTag(card, ['heat', 'cascade']) ||
        (effect.heatDelta ?? 0) > 0
      ) {
        return Object.freeze(['OPPONENT', 'GLOBAL'] as readonly Targeting[]);
      }

      return Object.freeze(['OPPONENT'] as readonly Targeting[]);

    case 'COUNTER':
      if (snapshot.mode === 'pvp') {
        return Object.freeze(['SELF'] as readonly Targeting[]);
      }

      if (snapshot.mode === 'coop') {
        return Object.freeze(['TEAMMATE', 'TEAM'] as readonly Targeting[]);
      }

      return EMPTY_TARGETINGS;

    case 'AID':
      return snapshot.mode === 'coop'
        ? Object.freeze(['TEAMMATE', 'TEAM', 'GLOBAL'] as readonly Targeting[])
        : EMPTY_TARGETINGS;

    case 'RESCUE':
      return snapshot.mode === 'coop'
        ? Object.freeze(['TEAMMATE', 'TEAM', 'GLOBAL'] as readonly Targeting[])
        : EMPTY_TARGETINGS;

    case 'TRUST':
      if (snapshot.mode !== 'coop') {
        return EMPTY_TARGETINGS;
      }

      if (isDefectionCard(card.definitionId)) {
        return SELF_ONLY_TARGETINGS;
      }

      if (effect.trustDelta !== undefined && effect.trustDelta < 0) {
        return Object.freeze(['SELF', 'TEAMMATE', 'TEAM'] as readonly Targeting[]);
      }

      return Object.freeze(['TEAMMATE', 'TEAM', 'GLOBAL'] as readonly Targeting[]);

    case 'BLUFF':
      if (snapshot.mode !== 'pvp') {
        return EMPTY_TARGETINGS;
      }

      if (effect.cashDelta !== undefined || effect.incomeDelta !== undefined) {
        return Object.freeze(['SELF', 'OPPONENT'] as readonly Targeting[]);
      }

      return Object.freeze(['OPPONENT'] as readonly Targeting[]);

    case 'GHOST':
      if (snapshot.mode !== 'ghost') {
        return EMPTY_TARGETINGS;
      }

      if (
        (effect.divergenceDelta ?? 0) > 0 ||
        hasAnyTag(card, ['divergence', 'precision'])
      ) {
        return Object.freeze(['SELF', 'GLOBAL'] as readonly Targeting[]);
      }

      return SELF_ONLY_TARGETINGS;

    case 'DISCIPLINE':
      if (snapshot.mode === 'coop' && hasAnyTag(card, ['resilience', 'variance'])) {
        return Object.freeze(['SELF', 'TEAM'] as readonly Targeting[]);
      }

      return SELF_ONLY_TARGETINGS;

    case 'PRIVILEGED':
      if (card.definitionId === 'SYSTEMIC_OVERRIDE') {
        return GLOBAL_ONLY_TARGETINGS;
      }

      if ((effect.heatDelta ?? 0) < 0 || (effect.timeDeltaMs ?? 0) !== 0) {
        return Object.freeze(['SELF', 'GLOBAL'] as readonly Targeting[]);
      }

      if (snapshot.mode === 'coop' && ((effect.treasuryDelta ?? 0) !== 0 || (effect.trustDelta ?? 0) !== 0)) {
        return Object.freeze(['SELF', 'TEAM', 'GLOBAL'] as readonly Targeting[]);
      }

      return Object.freeze(['SELF', 'GLOBAL'] as readonly Targeting[]);

    case 'OPPORTUNITY':
    case 'IPA':
      if (snapshot.mode === 'coop' && (effect.treasuryDelta ?? 0) > 0) {
        return Object.freeze(['SELF', 'TEAM'] as readonly Targeting[]);
      }

      return Object.freeze(['SELF', 'GLOBAL'] as readonly Targeting[]);

    case 'SO':
      if (hasTiming(card, 'CAS')) {
        return Object.freeze(['SELF', 'GLOBAL'] as readonly Targeting[]);
      }

      if (snapshot.mode === 'coop' && ((effect.treasuryDelta ?? 0) !== 0 || hasAnyTag(card, ['treasury']))) {
        return Object.freeze(['TEAM', 'GLOBAL'] as readonly Targeting[]);
      }

      return Object.freeze(['SELF', 'GLOBAL'] as readonly Targeting[]);

    case 'FUBAR':
      if (snapshot.mode === 'pvp' && hasAnyTag(card, ['sabotage', 'heat'])) {
        return Object.freeze(['OPPONENT', 'GLOBAL'] as readonly Targeting[]);
      }

      return Object.freeze(['SELF', 'GLOBAL'] as readonly Targeting[]);

    case 'MISSED_OPPORTUNITY':
      return SELF_ONLY_TARGETINGS;

    default:
      return TARGET_MATRIX[snapshot.mode][card.targeting];
  }
}

/* ──────────────────────────────────────────────────────────────────────────────
 * Named-card doctrine helpers
 * ──────────────────────────────────────────────────────────────────────────── */

function isDefectionCard(definitionId: string): boolean {
  return (
    definitionId === 'BREAK_PACT' ||
    definitionId === 'SILENT_EXIT' ||
    definitionId === 'ASSET_SEIZURE'
  );
}

function isGhostMarkerCard(card: CardInstance): boolean {
  return (
    card.card.deckType === 'GHOST' ||
    hasTiming(card, 'GBM') ||
    hasAnyTag(card, ['divergence', 'precision'])
  );
}

function isAidLikeCard(card: CardInstance): boolean {
  return (
    card.card.deckType === 'AID' ||
    hasTiming(card, 'AID') ||
    hasAnyTag(card, ['aid'])
  );
}

function isRescueLikeCard(card: CardInstance): boolean {
  return (
    card.card.deckType === 'RESCUE' ||
    hasTiming(card, 'RES') ||
    hasAnyTag(card, ['rescue'])
  );
}

function isCounterLikeCard(card: CardInstance): boolean {
  return (
    card.card.deckType === 'COUNTER' ||
    hasTiming(card, 'CTR') ||
    (card.card.baseEffect.counterIntelDelta ?? 0) !== 0 ||
    hasAnyTag(card, ['counterintel'])
  );
}

function isCascadeLikeCard(card: CardInstance): boolean {
  return (
    hasTiming(card, 'CAS') ||
    hasAnyTag(card, ['cascade']) ||
    card.definitionId === 'CASCADE_BREAK'
  );
}

function isPhaseBoundaryLikeCard(card: CardInstance): boolean {
  return hasTiming(card, 'PHZ');
}

function isSystemWideCard(card: CardInstance): boolean {
  return (
    card.targeting === 'GLOBAL' ||
    card.definitionId === 'SYSTEMIC_OVERRIDE' ||
    hasAnyTag(card, ['global', 'systemic']) ||
    (card.card.baseEffect.grantBadges?.length ?? 0) > 0
  );
}

function hasResolvedTargetShapeMismatch(
  card: CardInstance,
  targeting: Targeting,
): boolean {
  if (card.targeting === 'GLOBAL' && targeting !== 'GLOBAL') {
    return true;
  }

  if (card.targeting === 'OPPONENT' && targeting === 'SELF') {
    return true;
  }

  if (
    (card.targeting === 'TEAMMATE' || card.targeting === 'TEAM') &&
    targeting === 'OPPONENT'
  ) {
    return true;
  }

  return false;
}

/* ──────────────────────────────────────────────────────────────────────────────
 * Canonicalization
 * ------------------------------------------------------------------------------
 * We preserve explicit targeting, but allow narrow canonicalization where the
 * current repo already encoded ambiguity:
 * - TEAMMATE cards in coop may accept TEAM as a team-wide target class.
 * - Certain cooperative global cards may canonicalize TEAM -> GLOBAL when the
 *   card is structurally system-wide.
 *
 * We do not canonicalize SELF into GLOBAL, nor OPPONENT into anything else.
 * ──────────────────────────────────────────────────────────────────────────── */

function canonicalizeRequestedTarget(
  snapshot: RunStateSnapshot,
  card: CardInstance,
  targeting: Targeting,
): Targeting {
  if (
    snapshot.mode === 'coop' &&
    card.targeting === 'TEAMMATE' &&
    targeting === 'TEAM'
  ) {
    return 'TEAM';
  }

  if (
    snapshot.mode === 'coop' &&
    targeting === 'TEAM' &&
    isSystemWideCard(card)
  ) {
    return snapshot.modeState.sharedTreasury ? 'TEAM' : 'GLOBAL';
  }

  return targeting;
}

/* ──────────────────────────────────────────────────────────────────────────────
 * Rich summary / reason formatting
 * ──────────────────────────────────────────────────────────────────────────── */

function buildSummary(
  snapshot: RunStateSnapshot,
  card: CardInstance,
  requested: Targeting,
  allowedTargets: readonly Targeting[],
  reasons: readonly TargetReasonCode[],
): string {
  const modeSummary = MODE_SUMMARY[snapshot.mode];
  const deckSummary = DECK_SUMMARY[card.card.deckType];
  const allowedLabel = allowedTargets.length > 0
    ? allowedTargets.join(', ')
    : 'none';

  const reasonLabel = reasons.join(', ');

  return [
    `${card.definitionId} in ${snapshot.mode} requested ${requested}.`,
    `${modeSummary}`,
    `${deckSummary}`,
    `Allowed target classes after backend resolution: ${allowedLabel}.`,
    `Reasons: ${reasonLabel}.`,
  ].join(' ');
}

/* ──────────────────────────────────────────────────────────────────────────────
 * Main resolver
 * ──────────────────────────────────────────────────────────────────────────── */

export class CardTargetingResolver {
  /**
   * Backward-compatible boolean API consumed by CardLegalityService.
   */
  public isAllowed(
    snapshot: RunStateSnapshot,
    card: CardInstance,
    targeting: Targeting,
  ): boolean {
    return this.evaluate(snapshot, card, targeting).allowed;
  }

  /**
   * Rich evaluation API for future legality, telemetry, UI explanation, chat
   * narration, and audit surfaces.
   */
  public evaluate(
    snapshot: RunStateSnapshot,
    card: CardInstance,
    targeting: Targeting,
  ): TargetAllowance {
    const requested = targeting;
    const canonicalRequested = canonicalizeRequestedTarget(snapshot, card, targeting);
    const windows = readWindowState(snapshot);
    const context = buildModeContext(snapshot);
    const cardContext = buildCardContext(snapshot, card, requested);

    const reasons: TargetReasonCode[] = [];
    let allowedTargets = cardContext.allowedByBaseMode;

    /* ────────────────────────────────────────────────────────────────────────
     * Global hard stops
     * ────────────────────────────────────────────────────────────────────── */

    if (snapshot.outcome !== null) {
      reasons.push('TARGET_BLOCKED_BY_OUTCOME_FINALIZED');
      return this.finish(
        snapshot,
        card,
        requested,
        canonicalRequested,
        windows,
        context,
        reasons,
        EMPTY_TARGETINGS,
      );
    }

    if (context.isRuntimeQuarantined) {
      reasons.push('TARGET_BLOCKED_BY_WARNING_QUARANTINE');
      return this.finish(
        snapshot,
        card,
        requested,
        canonicalRequested,
        windows,
        context,
        reasons,
        EMPTY_TARGETINGS,
      );
    }

    if (
      card.decayTicksRemaining !== null &&
      card.decayTicksRemaining < 0
    ) {
      reasons.push('TARGET_BLOCKED_BY_CARD_STATE');
      return this.finish(
        snapshot,
        card,
        requested,
        canonicalRequested,
        windows,
        context,
        reasons,
        EMPTY_TARGETINGS,
      );
    }

    /* ────────────────────────────────────────────────────────────────────────
     * Base matrix
     * ────────────────────────────────────────────────────────────────────── */

    if (!includesTarget(cardContext.allowedByBaseMode, canonicalRequested)) {
      reasons.push('TARGET_NOT_IN_BASE_MODE_MATRIX');
    } else {
      reasons.push('TARGET_SUPPORTED');
    }

    /* ────────────────────────────────────────────────────────────────────────
     * Card-class allowance
     * ────────────────────────────────────────────────────────────────────── */

    allowedTargets = intersectTargetings(
      allowedTargets,
      cardContext.allowedByCardClass,
    );

    if (!includesTarget(cardContext.allowedByCardClass, canonicalRequested)) {
      reasons.push('TARGET_NOT_IN_CARD_CLASS_MATRIX');
    }

    /* ────────────────────────────────────────────────────────────────────────
     * Deck doctrine
     * ────────────────────────────────────────────────────────────────────── */

    allowedTargets = intersectTargetings(
      allowedTargets,
      cardContext.allowedByDeckDoctrine,
    );

    if (!includesTarget(cardContext.allowedByDeckDoctrine, canonicalRequested)) {
      reasons.push('TARGET_NOT_IN_DECK_DOCTRINE');
    }

    /* ────────────────────────────────────────────────────────────────────────
     * Timing doctrine
     * ────────────────────────────────────────────────────────────────────── */

    allowedTargets = intersectTargetings(
      allowedTargets,
      cardContext.allowedByTimingDoctrine,
    );

    if (!includesTarget(cardContext.allowedByTimingDoctrine, canonicalRequested)) {
      reasons.push('TARGET_NOT_IN_TIMING_DOCTRINE');
    }

    /* ────────────────────────────────────────────────────────────────────────
     * Tag doctrine
     * ────────────────────────────────────────────────────────────────────── */

    allowedTargets = intersectTargetings(
      allowedTargets,
      cardContext.allowedByTagDoctrine,
    );

    if (!includesTarget(cardContext.allowedByTagDoctrine, canonicalRequested)) {
      reasons.push('TARGET_NOT_IN_TAG_DOCTRINE');
    }

    /* ────────────────────────────────────────────────────────────────────────
     * Runtime gating: PVP / extraction / counter windows
     * ────────────────────────────────────────────────────────────────────── */

    if (snapshot.mode === 'pvp') {
      if (!context.hasOpponentLane) {
        allowedTargets = subtractTargetings(allowedTargets, ['OPPONENT']);
        if (canonicalRequested === 'OPPONENT') {
          reasons.push('TARGET_BLOCKED_BY_PVP_CONTEXT_REQUIREMENT');
        }
      }

      if (isCounterLikeCard(card)) {
        if (!windows.CTR) {
          allowedTargets = subtractTargetings(allowedTargets, ['SELF']);
          if (canonicalRequested === 'SELF') {
            reasons.push('TARGET_BLOCKED_BY_COUNTER_WINDOW_REQUIREMENT');
          }
        }

        if (!context.hasExtractionLane) {
          allowedTargets = subtractTargetings(allowedTargets, ['SELF']);
          if (canonicalRequested === 'SELF') {
            reasons.push('TARGET_BLOCKED_BY_EXTRACTION_CONTEXT_REQUIREMENT');
          }
        }
      }

      if (
        card.card.deckType === 'SABOTAGE' &&
        snapshot.modeState.extractionActionsRemaining <= 0 &&
        hasAnyTag(card, ['sabotage']) &&
        hasTiming(card, 'CTR')
      ) {
        allowedTargets = subtractTargetings(allowedTargets, ['OPPONENT']);
        if (canonicalRequested === 'OPPONENT') {
          reasons.push('TARGET_BLOCKED_BY_EXTRACTION_CONTEXT_REQUIREMENT');
        }
      }
    } else {
      if (canonicalRequested === 'OPPONENT') {
        reasons.push('TARGET_BLOCKED_BY_PVP_CONTEXT_REQUIREMENT');
      }
    }

    /* ────────────────────────────────────────────────────────────────────────
     * Runtime gating: cooperative context / treasury / rescue / aid
     * ────────────────────────────────────────────────────────────────────── */

    if (snapshot.mode === 'coop') {
      const coopContextHealthy =
        context.hasCoopLane ||
        snapshot.modeState.sharedTreasury ||
        snapshot.modeState.roleLockEnabled ||
        snapshot.modeState.sharedOpportunityDeck;

      if (!coopContextHealthy) {
        allowedTargets = subtractTargetings(allowedTargets, COOP_HELPER_TARGETINGS);
        if (
          canonicalRequested === 'TEAMMATE' ||
          canonicalRequested === 'TEAM'
        ) {
          reasons.push('TARGET_BLOCKED_BY_COOP_CONTEXT_REQUIREMENT');
        }
      }

      if (isAidLikeCard(card) && !windows.AID && !hasTiming(card, 'ANY')) {
        allowedTargets = subtractTargetings(allowedTargets, ['TEAMMATE', 'TEAM', 'GLOBAL']);
        if (
          canonicalRequested === 'TEAMMATE' ||
          canonicalRequested === 'TEAM' ||
          canonicalRequested === 'GLOBAL'
        ) {
          reasons.push('TARGET_BLOCKED_BY_AID_WINDOW_REQUIREMENT');
        }
      }

      if (isRescueLikeCard(card) && !windows.RES && !hasTiming(card, 'ANY')) {
        allowedTargets = subtractTargetings(allowedTargets, ['TEAMMATE', 'TEAM', 'GLOBAL']);
        if (
          canonicalRequested === 'TEAMMATE' ||
          canonicalRequested === 'TEAM' ||
          canonicalRequested === 'GLOBAL'
        ) {
          reasons.push('TARGET_BLOCKED_BY_RESCUE_WINDOW_REQUIREMENT');
        }
      }

      if (
        (cardContext.hasTreasuryEffect || hasAnyTag(card, ['treasury'])) &&
        !context.hasSharedTreasuryLane
      ) {
        allowedTargets = subtractTargetings(allowedTargets, ['TEAM', 'GLOBAL']);
        if (
          canonicalRequested === 'TEAM' ||
          canonicalRequested === 'GLOBAL'
        ) {
          reasons.push('TARGET_BLOCKED_BY_SHARED_TREASURY_REQUIREMENT');
        }
      }

      if (
        snapshot.modeState.roleLockEnabled &&
        isDefectionCard(card.definitionId) &&
        canonicalRequested !== 'SELF'
      ) {
        allowedTargets = subtractTargetings(allowedTargets, ['TEAMMATE', 'TEAM', 'GLOBAL']);
        reasons.push('TARGET_BLOCKED_BY_ROLE_LOCK');
      }

      if (
        snapshot.modeState.disabledBots.length > 0 &&
        canonicalRequested === 'GLOBAL' &&
        hasAnyTag(card, ['heat', 'momentum']) &&
        card.card.deckType === 'TRUST'
      ) {
        reasons.push('TARGET_BLOCKED_BY_DISABLED_BOT_CONTEXT');
        allowedTargets = subtractTargetings(allowedTargets, ['GLOBAL']);
      }
    } else if (
      canonicalRequested === 'TEAMMATE' ||
      canonicalRequested === 'TEAM'
    ) {
      reasons.push('TARGET_BLOCKED_BY_COOP_CONTEXT_REQUIREMENT');
    }

    /* ────────────────────────────────────────────────────────────────────────
     * Runtime gating: ghost context
     * ────────────────────────────────────────────────────────────────────── */

    if (snapshot.mode === 'ghost') {
      if (isGhostMarkerCard(card) && !context.hasLegendLane) {
        allowedTargets = subtractTargetings(allowedTargets, ['SELF', 'GLOBAL']);
        if (
          canonicalRequested === 'SELF' ||
          canonicalRequested === 'GLOBAL'
        ) {
          reasons.push('TARGET_BLOCKED_BY_GHOST_MARKER_REQUIREMENT');
        }
      }

      if (isGhostMarkerCard(card) && !windows.GBM && !hasTiming(card, 'ANY')) {
        allowedTargets = subtractTargetings(allowedTargets, ['SELF', 'GLOBAL']);
        if (
          canonicalRequested === 'SELF' ||
          canonicalRequested === 'GLOBAL'
        ) {
          reasons.push('TARGET_BLOCKED_BY_GHOST_MARKER_REQUIREMENT');
        }
      }

      if (
        cardContext.hasCounterIntelEffect &&
        !context.hasCounterIntelLane
      ) {
        allowedTargets = subtractTargetings(allowedTargets, ['SELF', 'GLOBAL']);
        if (
          canonicalRequested === 'SELF' ||
          canonicalRequested === 'GLOBAL'
        ) {
          reasons.push('TARGET_BLOCKED_BY_COUNTER_INTEL_REQUIREMENT');
        }
      }
    } else if (card.card.deckType === 'GHOST' || hasTiming(card, 'GBM')) {
      reasons.push('TARGET_BLOCKED_BY_GHOST_CONTEXT_REQUIREMENT');
    }

    /* ────────────────────────────────────────────────────────────────────────
     * Runtime gating: phase / cascade / named-card special cases
     * ────────────────────────────────────────────────────────────────────── */

    if (isPhaseBoundaryLikeCard(card)) {
      if (!context.hasPhaseBoundaryLane && !windows.PHZ) {
        allowedTargets = subtractTargetings(allowedTargets, ['SELF', 'TEAM', 'GLOBAL']);
        if (
          canonicalRequested === 'SELF' ||
          canonicalRequested === 'TEAM' ||
          canonicalRequested === 'GLOBAL'
        ) {
          reasons.push('TARGET_BLOCKED_BY_PHASE_BOUNDARY_REQUIREMENT');
        }
      }
    }

    if (isCascadeLikeCard(card)) {
      if (!windows.CAS && snapshot.cascade.activeChains.length === 0) {
        allowedTargets = subtractTargetings(allowedTargets, ['SELF', 'TEAM', 'GLOBAL']);
        if (
          canonicalRequested === 'SELF' ||
          canonicalRequested === 'TEAM' ||
          canonicalRequested === 'GLOBAL'
        ) {
          reasons.push('TARGET_BLOCKED_BY_CASCADE_WINDOW_REQUIREMENT');
        }
      }
    }

    if (card.definitionId === 'SYSTEMIC_OVERRIDE') {
      allowedTargets = intersectTargetings(allowedTargets, ['GLOBAL']);
      if (canonicalRequested !== 'GLOBAL') {
        reasons.push('TARGET_BLOCKED_BY_CARD_DOCTRINE');
      }
    }

    if (card.definitionId === 'BREAK_PACT') {
      allowedTargets = intersectTargetings(allowedTargets, ['SELF']);
      if (canonicalRequested !== 'SELF') {
        reasons.push('TARGET_BLOCKED_BY_CARD_DOCTRINE');
      }
    }

    if (card.definitionId === 'SILENT_EXIT') {
      allowedTargets = intersectTargetings(allowedTargets, ['SELF']);
      if (canonicalRequested !== 'SELF') {
        reasons.push('TARGET_BLOCKED_BY_CARD_DOCTRINE');
      }
    }

    if (card.definitionId === 'ASSET_SEIZURE') {
      allowedTargets = intersectTargetings(allowedTargets, ['SELF']);
      if (canonicalRequested !== 'SELF') {
        reasons.push('TARGET_BLOCKED_BY_CARD_DOCTRINE');
      }

      if (!snapshot.modeState.sharedTreasury) {
        reasons.push('TARGET_BLOCKED_BY_SHARED_TREASURY_REQUIREMENT');
        allowedTargets = subtractTargetings(allowedTargets, ['SELF']);
      }
    }

    if (
      card.definitionId === 'MARKER_EXPLOIT' ||
      card.definitionId === 'COUNTER_LEGEND_LINE' ||
      card.definitionId === 'GHOST_PASS_EXPLOIT'
    ) {
      if (!snapshot.modeState.legendMarkersEnabled && snapshot.cards.ghostMarkers.length === 0) {
        reasons.push('TARGET_BLOCKED_BY_GHOST_MARKER_REQUIREMENT');
        allowedTargets = EMPTY_TARGETINGS;
      }
    }

    /* ────────────────────────────────────────────────────────────────────────
     * Shape mismatch / canonicalization guards
     * ────────────────────────────────────────────────────────────────────── */

    if (hasResolvedTargetShapeMismatch(card, canonicalRequested)) {
      reasons.push('TARGET_BLOCKED_BY_REQUEST_CANONICALIZATION');
      allowedTargets = subtractTargetings(
        allowedTargets,
        [canonicalRequested],
      );
    }

    if (
      requested !== canonicalRequested &&
      includesTarget(allowedTargets, canonicalRequested)
    ) {
      reasons.push('TARGET_ALLOWED_AFTER_CANONICALIZATION');
    }

    /* ────────────────────────────────────────────────────────────────────────
     * Final mode doctrine hard stop
     * ────────────────────────────────────────────────────────────────────── */

    if (
      snapshot.mode === 'solo' &&
      (canonicalRequested === 'OPPONENT' ||
        canonicalRequested === 'TEAMMATE' ||
        canonicalRequested === 'TEAM')
    ) {
      reasons.push('TARGET_BLOCKED_BY_MODE_DOCTRINE');
    }

    if (
      snapshot.mode === 'ghost' &&
      (canonicalRequested === 'OPPONENT' ||
        canonicalRequested === 'TEAMMATE' ||
        canonicalRequested === 'TEAM')
    ) {
      reasons.push('TARGET_BLOCKED_BY_MODE_DOCTRINE');
    }

    const allowed = includesTarget(allowedTargets, canonicalRequested);

    if (!allowed && reasons.length === 0) {
      reasons.push('TARGET_BLOCKED_BY_RUNTIME_RULE');
    }

    return this.finish(
      snapshot,
      card,
      requested,
      canonicalRequested,
      windows,
      context,
      reasons,
      allowedTargets,
    );
  }

  /**
   * Throws a rich error if the target class is not legal.
   */
  public assertAllowed(
    snapshot: RunStateSnapshot,
    card: CardInstance,
    targeting: Targeting,
  ): void {
    const result = this.evaluate(snapshot, card, targeting);

    if (!result.allowed) {
      throw new Error(result.summary);
    }
  }

  /**
   * Returns the canonical backend-allowed target classes for this card in the
   * provided snapshot. Useful for UI hints, bot planning, tests, and audits.
   */
  public resolveAllowedTargets(
    snapshot: RunStateSnapshot,
    card: CardInstance,
  ): readonly Targeting[] {
    const result = this.evaluate(snapshot, card, card.targeting);
    return result.allowedTargets;
  }

  /**
   * Returns a deterministic explanation string without throwing.
   */
  public explain(
    snapshot: RunStateSnapshot,
    card: CardInstance,
    targeting: Targeting,
  ): string {
    return this.evaluate(snapshot, card, targeting).summary;
  }

  /**
   * Returns whether this card is effectively global in the current snapshot.
   * Useful for orchestration, transcript narration, or effect fanout planning.
   */
  public isGlobalShape(
    snapshot: RunStateSnapshot,
    card: CardInstance,
  ): boolean {
    const allowed = this.resolveAllowedTargets(snapshot, card);
    return allowed.length === 1 && allowed[0] === 'GLOBAL';
  }

  /**
   * Returns whether the card has any cooperative target lane in the current
   * snapshot after doctrine is applied.
   */
  public hasCooperativeTargetLane(
    snapshot: RunStateSnapshot,
    card: CardInstance,
  ): boolean {
    const allowed = this.resolveAllowedTargets(snapshot, card);

    return (
      allowed.includes('TEAMMATE') ||
      allowed.includes('TEAM')
    );
  }

  /**
   * Returns whether the card has any opponent lane in the current snapshot.
   */
  public hasOpponentTargetLane(
    snapshot: RunStateSnapshot,
    card: CardInstance,
  ): boolean {
    return this.resolveAllowedTargets(snapshot, card).includes('OPPONENT');
  }

  /* ──────────────────────────────────────────────────────────────────────────
   * Batch / hand / advisory APIs
   * ────────────────────────────────────────────────────────────────────────── */

  /**
   * Resolves the UNION of allowed targeting classes across a hand of cards.
   *
   * Uses `unionTargetings` to aggregate every reachable target class so the
   * UX "show all playable zones" layer can highlight exactly which lanes have
   * at least one playable card without iterating cards themselves.
   *
   * Consumed by:
   * - Hand highlight layer (which target-class icons are lit)
   * - AI planner first-pass scan (what is reachable at all?)
   * - Chat narration pre-filter (which zones can we describe?)
   */
  public resolveUnionTargeting(
    snapshot: RunStateSnapshot,
    cards: readonly CardInstance[],
  ): readonly Targeting[] {
    const targetingLists = cards.map(
      (card) => this.resolveAllowedTargets(snapshot, card),
    );
    if (targetingLists.length === 0) {
      return EMPTY_TARGETINGS;
    }
    return unionTargetings(...targetingLists);
  }

  /**
   * Summarizes the targeting posture of an entire hand: union coverage,
   * per-target-class card counts, deck-type breakdown, and cooperative /
   * opponent / global presence flags.
   *
   * Consumed by:
   * - UX hand-state layer (highlights which lanes are reachable)
   * - AI hand planner (know full option set before single-card decisions)
   * - Chat narration (describe what the player can do from this hand)
   * - Telemetry (measure targeting distribution across sessions)
   */
  public buildHandTargetingSummary(
    snapshot: RunStateSnapshot,
    hand: readonly CardInstance[],
  ): TargetingHandSummary {
    const mode = snapshot.mode;
    let selfCount = 0;
    let opponentCount = 0;
    let teammateCount = 0;
    let teamCount = 0;
    let globalCount = 0;
    let playableCount = 0;
    const deckTypeBreakdown: Record<string, number> = {};
    const targetingLists: (readonly Targeting[])[] = [];

    for (const card of hand) {
      const allowed = this.resolveAllowedTargets(snapshot, card);

      if (allowed.length > 0) {
        playableCount++;
        targetingLists.push(allowed);
      }

      if (allowed.includes('SELF')) selfCount++;
      if (allowed.includes('OPPONENT')) opponentCount++;
      if (allowed.includes('TEAMMATE')) teammateCount++;
      if (allowed.includes('TEAM')) teamCount++;
      if (allowed.includes('GLOBAL')) globalCount++;

      const dt = card.card.deckType;
      deckTypeBreakdown[dt] = (deckTypeBreakdown[dt] ?? 0) + 1;
    }

    const unionAllTargetings =
      targetingLists.length > 0
        ? unionTargetings(...targetingLists)
        : EMPTY_TARGETINGS;

    return Object.freeze({
      mode,
      totalCards: hand.length,
      playableCards: playableCount,
      blockedCards: hand.length - playableCount,
      selfTargetableCount: selfCount,
      opponentTargetableCount: opponentCount,
      teammateTargetableCount: teammateCount,
      teamTargetableCount: teamCount,
      globalTargetableCount: globalCount,
      unionAllTargetings,
      deckTypeBreakdown: Object.freeze({ ...deckTypeBreakdown }),
      hasAnyCooperativeTarget: teammateCount > 0 || teamCount > 0,
      hasAnyOpponentTarget: opponentCount > 0,
      hasAnyGlobalTarget: globalCount > 0,
    });
  }

  /**
   * Builds a targeting advisory for a specific card + requested targeting:
   * includes alternative targets, mode-default union, urgency label, and a
   * natural-language narrative suitable for UX tooltips or chat narration.
   *
   * Consumed by:
   * - UX card-hover state: "This card cannot target OPPONENT right now."
   * - Chat narrator: "You could target your TEAM instead."
   * - AI planner fallback: try alternatives in advisory order.
   */
  public buildTargetingAdvisory(
    snapshot: RunStateSnapshot,
    card: CardInstance,
    requested: Targeting,
  ): TargetingAdvisory {
    const allowance = this.evaluate(snapshot, card, requested);
    const allowed = this.resolveAllowedTargets(snapshot, card);
    const modeDefaults = TARGET_MATRIX[snapshot.mode][card.targeting];
    const alternativeTargets = allowed.filter((t) => t !== requested);
    const unionWithModeDefaults = unionTargetings(allowed, modeDefaults);

    let urgencyLabel: 'CRITICAL' | 'WARNING' | 'INFO' | 'OK';

    if (!allowance.allowed && allowed.length === 0) {
      urgencyLabel = 'CRITICAL';
    } else if (!allowance.allowed) {
      urgencyLabel = 'WARNING';
    } else if (
      allowance.reasons.includes('TARGET_ALLOWED_AFTER_CANONICALIZATION')
    ) {
      urgencyLabel = 'INFO';
    } else {
      urgencyLabel = 'OK';
    }

    const narrative = allowance.allowed
      ? [
          `${card.definitionId}: target class ${requested} is allowed in ${snapshot.mode}.`,
          alternativeTargets.length > 0
            ? `Alternative targets: ${alternativeTargets.join(', ')}.`
            : 'No other target classes available for this card right now.',
        ].join(' ')
      : [
          `${card.definitionId}: target class ${requested} is blocked in ${snapshot.mode}.`,
          `Reason: ${allowance.reasons.join(', ')}.`,
          alternativeTargets.length > 0
            ? `You may use: ${alternativeTargets.join(', ')} instead.`
            : 'No valid targets remain for this card in the current state.',
        ].join(' ');

    return Object.freeze({
      card,
      requestedTargeting: requested,
      allowance,
      alternativeTargets: Object.freeze(alternativeTargets),
      unionWithModeDefaults,
      narrative,
      urgencyLabel,
    });
  }

  /**
   * Evaluates a batch of cards against a specific target class.
   * Returns a `TargetingBatchResult` per card — used by AI planning,
   * legality audits, and UX hand filtering (e.g. "which cards can hit OPPONENT?").
   */
  public evaluateBatch(
    snapshot: RunStateSnapshot,
    cards: readonly CardInstance[],
    targeting: Targeting,
  ): readonly TargetingBatchResult[] {
    return Object.freeze(
      cards.map((card) => ({
        card,
        targeting,
        allowance: this.evaluate(snapshot, card, targeting),
      })),
    );
  }

  /**
   * Full diagnostic report for a specific card + targeting request.
   * Includes all context layers, union-resolved targetings, doctrine summary,
   * and a 0–100 health score for the targeting request.
   *
   * Consumed by:
   * - Proof audit / replay annotation
   * - Chat narration deep-dive ("here is why your card cannot hit OPPONENT")
   * - Backend integration tests
   * - Dev/ops diagnostics tooling
   */
  public buildDiagnosticReport(
    snapshot: RunStateSnapshot,
    card: CardInstance,
    targeting: Targeting,
  ): TargetingDiagnosticReport {
    const allowance = this.evaluate(snapshot, card, targeting);
    const cardContext = buildCardContext(snapshot, card, targeting);
    const modeContext = buildModeContext(snapshot);
    const windowState = readWindowState(snapshot);
    const allowed = this.resolveAllowedTargets(snapshot, card);
    const modeDefaults = TARGET_MATRIX[snapshot.mode][card.targeting];
    const unionAllowedTargetings = unionTargetings(allowed, modeDefaults);

    const isCooperativeCard =
      card.card.deckType === 'AID' ||
      card.card.deckType === 'RESCUE' ||
      card.card.deckType === 'TRUST' ||
      card.card.deckType === 'COUNTER';

    const isPredatorCard =
      card.card.deckType === 'SABOTAGE' || card.card.deckType === 'BLUFF';

    const isGhostCard = card.card.deckType === 'GHOST';

    const passedChecks = [
      allowance.reasons.includes('TARGET_SUPPORTED'),
      !allowance.reasons.includes('TARGET_NOT_IN_CARD_CLASS_MATRIX'),
      !allowance.reasons.includes('TARGET_NOT_IN_DECK_DOCTRINE'),
      !allowance.reasons.includes('TARGET_NOT_IN_TIMING_DOCTRINE'),
      !allowance.reasons.includes('TARGET_NOT_IN_TAG_DOCTRINE'),
    ].filter(Boolean).length;

    const healthScore = Math.round((passedChecks / 5) * 100);

    const doctrineSummary = [
      `Mode: ${snapshot.mode} — ${MODE_SUMMARY[snapshot.mode]}`,
      `Deck: ${card.card.deckType} — ${DECK_SUMMARY[card.card.deckType]}`,
      `Timing: ${card.timingClass.join(', ') || 'none'}`,
      `Tags: ${card.tags.join(', ') || 'none'}`,
      `Union resolved: ${unionAllowedTargetings.join(', ') || 'none'}`,
    ].join(' | ');

    return Object.freeze({
      definitionId: card.definitionId,
      mode: snapshot.mode,
      deckType: card.card.deckType,
      requestedTargeting: targeting,
      allowance,
      cardContext,
      modeContext,
      windowState,
      doctrineSummary,
      unionAllowedTargetings,
      isGlobalShape: this.isGlobalShape(snapshot, card),
      isCooperativeCard,
      isPredatorCard,
      isGhostCard,
      healthScore,
    });
  }

  /**
   * Returns whether ANY card in the provided hand can reach the requested
   * target class in the current snapshot. Useful for fast "is this lane alive?"
   * checks before building a full summary.
   */
  public handCanReachTarget(
    snapshot: RunStateSnapshot,
    hand: readonly CardInstance[],
    targeting: Targeting,
  ): boolean {
    return hand.some((card) => this.isAllowed(snapshot, card, targeting));
  }

  /**
   * Returns the subset of cards in `hand` that are allowed to target the
   * provided `targeting` class. Useful for AI hand selection and UX filters.
   */
  public filterByTargeting(
    snapshot: RunStateSnapshot,
    hand: readonly CardInstance[],
    targeting: Targeting,
  ): readonly CardInstance[] {
    return Object.freeze(
      hand.filter((card) => this.isAllowed(snapshot, card, targeting)),
    );
  }

  /**
   * Returns the union of allowed targetings for cards that have AT LEAST ONE
   * cooperative lane. Useful for composing Syndicate hand narratives.
   */
  public resolveCoopUnionTargeting(
    snapshot: RunStateSnapshot,
    hand: readonly CardInstance[],
  ): readonly Targeting[] {
    const coopCards = hand.filter((c) => this.hasCooperativeTargetLane(snapshot, c));
    return this.resolveUnionTargeting(snapshot, coopCards);
  }

  private finish(
    snapshot: RunStateSnapshot,
    card: CardInstance,
    requested: Targeting,
    canonicalRequested: Targeting,
    windows: TargetWindowState,
    context: TargetModeContext,
    reasons: readonly TargetReasonCode[],
    allowedTargets: readonly Targeting[],
  ): TargetAllowance {
    const canonicalAllowedTargets = uniqueTargetings(allowedTargets);
    const blockedTargets = buildBlockedTargets(canonicalAllowedTargets);
    const allowed = includesTarget(canonicalAllowedTargets, canonicalRequested);

    return Object.freeze({
      allowed,
      requested,
      canonicalRequested,
      canonicalCardTarget: card.targeting,
      mode: snapshot.mode,
      reasons: Object.freeze([...reasons]),
      allowedTargets: canonicalAllowedTargets,
      blockedTargets,
      windows,
      context,
      summary: buildSummary(
        snapshot,
        card,
        requested,
        canonicalAllowedTargets,
        reasons,
      ),
    });
  }
}

/* ──────────────────────────────────────────────────────────────────────────────
 * Extended doctrine helpers for future test and audit consumers
 * ------------------------------------------------------------------------------
 * These are intentionally exported so adjacent systems can reuse the exact same
 * targeting doctrine without re-encoding it:
 * - legality tests
 * - chat narration
 * - case-file audit surfaces
 * - proof-chain explanation artifacts
 * ──────────────────────────────────────────────────────────────────────────── */

export const CARD_TARGETING_DOCTRINE = Object.freeze({
  TARGET_MATRIX,
  DECK_TARGET_DOCTRINE,
  TIMING_TARGET_DOCTRINE,
  TAG_TARGET_DOCTRINE,
  MODE_SUMMARY,
  DECK_SUMMARY,
});

export function getBaseModeTargetMatrix(
  mode: ModeCode,
  targeting: Targeting,
): readonly Targeting[] {
  return TARGET_MATRIX[mode][targeting];
}

export function getDeckTargetDoctrine(
  deckType: DeckType,
  mode: ModeCode,
): readonly Targeting[] {
  return DECK_TARGET_DOCTRINE[deckType][mode];
}

export function getTimingTargetDoctrine(
  timingClass: TimingClass,
  mode: ModeCode,
): readonly Targeting[] {
  return TIMING_TARGET_DOCTRINE[timingClass][mode];
}

export function getTagTargetDoctrine(
  tag: string,
  mode: ModeCode,
): readonly Targeting[] {
  const doctrine = TAG_TARGET_DOCTRINE[tag];
  return doctrine ? doctrine[mode] : ALL_TARGETINGS;
}

/* ──────────────────────────────────────────────────────────────────────────────
 * Deep deterministic check helpers
 * ------------------------------------------------------------------------------
 * These keep the file self-sufficient for future scaling. They are currently
 * used only internally by tests or future integrations, but are kept here so
 * target doctrine remains single-sourced.
 * ──────────────────────────────────────────────────────────────────────────── */

export function projectTargetWindows(
  snapshot: RunStateSnapshot,
): TargetWindowState {
  return readWindowState(snapshot);
}

export function projectTargetModeContext(
  snapshot: RunStateSnapshot,
): TargetModeContext {
  return buildModeContext(snapshot);
}

export function projectTargetCardContext(
  snapshot: RunStateSnapshot,
  card: CardInstance,
  requested: Targeting,
): TargetCardContext {
  return buildCardContext(snapshot, card, requested);
}

export function deriveAllowedTargetsForCard(
  snapshot: RunStateSnapshot,
  card: CardInstance,
): readonly Targeting[] {
  return new CardTargetingResolver().resolveAllowedTargets(snapshot, card);
}

export function canResolveTargetClass(
  snapshot: RunStateSnapshot,
  card: CardInstance,
  targeting: Targeting,
): boolean {
  return new CardTargetingResolver().isAllowed(snapshot, card, targeting);
}

/* ──────────────────────────────────────────────────────────────────────────────
 * Additional deck-specific doctrine predicates
 * ------------------------------------------------------------------------------
 * These helpers are intentionally verbose because they encode domain meaning
 * that should remain centralized rather than scattered into higher-level
 * services.
 * ──────────────────────────────────────────────────────────────────────────── */

export function cardRepresentsPredatorPressure(
  snapshot: RunStateSnapshot,
  card: CardInstance,
): boolean {
  if (snapshot.mode !== 'pvp') {
    return false;
  }

  return (
    card.card.deckType === 'SABOTAGE' ||
    card.card.deckType === 'BLUFF' ||
    hasAnyTag(card, ['sabotage', 'momentum', 'heat'])
  );
}

export function cardRepresentsSyndicateRescue(
  snapshot: RunStateSnapshot,
  card: CardInstance,
): boolean {
  if (snapshot.mode !== 'coop') {
    return false;
  }

  return isRescueLikeCard(card);
}

export function cardRepresentsSyndicateAid(
  snapshot: RunStateSnapshot,
  card: CardInstance,
): boolean {
  if (snapshot.mode !== 'coop') {
    return false;
  }

  return isAidLikeCard(card);
}

export function cardRepresentsGhostInstrumentation(
  snapshot: RunStateSnapshot,
  card: CardInstance,
): boolean {
  if (snapshot.mode !== 'ghost') {
    return false;
  }

  return isGhostMarkerCard(card);
}

export function cardRepresentsPhaseBoundaryMacroDecision(
  card: CardInstance,
): boolean {
  return isPhaseBoundaryLikeCard(card);
}

export function cardRepresentsCascadeIntervention(
  card: CardInstance,
): boolean {
  return isCascadeLikeCard(card);
}

export function cardRequiresSharedTreasuryLane(
  card: CardInstance,
): boolean {
  return (
    (card.card.baseEffect.treasuryDelta ?? 0) !== 0 ||
    hasAnyTag(card, ['treasury']) ||
    card.definitionId === 'ASSET_SEIZURE'
  );
}

export function cardRequiresCounterIntelLane(
  card: CardInstance,
): boolean {
  return (
    (card.card.baseEffect.counterIntelDelta ?? 0) !== 0 ||
    hasAnyTag(card, ['counterintel'])
  );
}

export function cardRequiresLegendLane(
  card: CardInstance,
): boolean {
  return isGhostMarkerCard(card);
}

export function cardRequiresExtractionLane(
  snapshot: RunStateSnapshot,
  card: CardInstance,
): boolean {
  return snapshot.mode === 'pvp' && isCounterLikeCard(card);
}

export function cardTargetNarrativeLabel(
  snapshot: RunStateSnapshot,
  card: CardInstance,
): string {
  const allowedTargets = deriveAllowedTargetsForCard(snapshot, card);

  if (allowedTargets.length === 0) {
    return 'NO_VALID_TARGET_CLASS';
  }

  if (allowedTargets.length === 1) {
    return allowedTargets[0];
  }

  return allowedTargets.join('_OR_');
}

/* ──────────────────────────────────────────────────────────────────────────────
 * Defensive invariant checks
 * ------------------------------------------------------------------------------
 * These helpers are pure and deterministic. They can be reused by tests or by
 * future boot-time self-tests if you want the backend to assert doctrine health.
 * ──────────────────────────────────────────────────────────────────────────── */

export function hasCompleteModeMatrixCoverage(): boolean {
  for (const mode of Object.keys(TARGET_MATRIX) as ModeCode[]) {
    for (const targeting of ALL_TARGETINGS) {
      if (!TARGET_MATRIX[mode][targeting]) {
        return false;
      }
    }
  }

  return true;
}

export function hasCompleteDeckDoctrineCoverage(): boolean {
  const deckTypes: readonly DeckType[] = Object.freeze([
    'OPPORTUNITY',
    'IPA',
    'FUBAR',
    'MISSED_OPPORTUNITY',
    'PRIVILEGED',
    'SO',
    'SABOTAGE',
    'COUNTER',
    'AID',
    'RESCUE',
    'DISCIPLINE',
    'TRUST',
    'BLUFF',
    'GHOST',
  ] as const);

  for (const deckType of deckTypes) {
    const doctrine = DECK_TARGET_DOCTRINE[deckType];
    if (!doctrine) {
      return false;
    }

    for (const mode of Object.keys(TARGET_MATRIX) as ModeCode[]) {
      if (!doctrine[mode]) {
        return false;
      }
    }
  }

  return true;
}

export function hasCompleteTimingDoctrineCoverage(): boolean {
  const timingClasses: readonly TimingClass[] = Object.freeze([
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

  for (const timingClass of timingClasses) {
    const doctrine = TIMING_TARGET_DOCTRINE[timingClass];
    if (!doctrine) {
      return false;
    }

    for (const mode of Object.keys(TARGET_MATRIX) as ModeCode[]) {
      if (!doctrine[mode]) {
        return false;
      }
    }
  }

  return true;
}

export function assertTargetDoctrineHealthy(): void {
  if (!hasCompleteModeMatrixCoverage()) {
    throw new Error('Card targeting doctrine missing mode matrix coverage.');
  }

  if (!hasCompleteDeckDoctrineCoverage()) {
    throw new Error('Card targeting doctrine missing deck doctrine coverage.');
  }

  if (!hasCompleteTimingDoctrineCoverage()) {
    throw new Error('Card targeting doctrine missing timing doctrine coverage.');
  }
}

/* ──────────────────────────────────────────────────────────────────────────────
 * Boot-time no-op export for explicit invocation by tests or startup code.
 * Kept separate from module top-level side effects to preserve deterministic
 * import behavior.
 * ──────────────────────────────────────────────────────────────────────────── */

export function warmCardTargetingDoctrine(): void {
  assertTargetDoctrineHealthy();
}

/* ──────────────────────────────────────────────────────────────────────────────
 * Batch / hand / advisory / diagnostic result shapes
 * ──────────────────────────────────────────────────────────────────────────── */

export interface TargetingBatchResult {
  readonly card: CardInstance;
  readonly targeting: Targeting;
  readonly allowance: TargetAllowance;
}

export interface TargetingHandSummary {
  readonly mode: ModeCode;
  readonly totalCards: number;
  readonly playableCards: number;
  readonly blockedCards: number;
  readonly selfTargetableCount: number;
  readonly opponentTargetableCount: number;
  readonly teammateTargetableCount: number;
  readonly teamTargetableCount: number;
  readonly globalTargetableCount: number;
  readonly unionAllTargetings: readonly Targeting[];
  readonly deckTypeBreakdown: Readonly<Record<string, number>>;
  readonly hasAnyCooperativeTarget: boolean;
  readonly hasAnyOpponentTarget: boolean;
  readonly hasAnyGlobalTarget: boolean;
}

export interface TargetingAdvisory {
  readonly card: CardInstance;
  readonly requestedTargeting: Targeting;
  readonly allowance: TargetAllowance;
  readonly alternativeTargets: readonly Targeting[];
  readonly unionWithModeDefaults: readonly Targeting[];
  readonly narrative: string;
  readonly urgencyLabel: 'CRITICAL' | 'WARNING' | 'INFO' | 'OK';
}

export interface TargetingDiagnosticReport {
  readonly definitionId: string;
  readonly mode: ModeCode;
  readonly deckType: DeckType;
  readonly requestedTargeting: Targeting;
  readonly allowance: TargetAllowance;
  readonly cardContext: TargetCardContext;
  readonly modeContext: TargetModeContext;
  readonly windowState: TargetWindowState;
  readonly doctrineSummary: string;
  readonly unionAllowedTargetings: readonly Targeting[];
  readonly isGlobalShape: boolean;
  readonly isCooperativeCard: boolean;
  readonly isPredatorCard: boolean;
  readonly isGhostCard: boolean;
  readonly healthScore: number;
}

/* ──────────────────────────────────────────────────────────────────────────────
 * Doctrine utility helpers
 * ──────────────────────────────────────────────────────────────────────────── */

/** Returns all defined targeting classes in canonical order. */
export function listAllTargetings(): readonly Targeting[] {
  return ALL_TARGETINGS;
}

/**
 * Returns all targeting classes that are allowed in a mode's base matrix —
 * i.e. the set of targetings for which TARGET_MATRIX[mode][t] is non-empty.
 */
export function getTargetingsByMode(mode: ModeCode): readonly Targeting[] {
  const result: Targeting[] = [];
  for (const targeting of ALL_TARGETINGS) {
    if (TARGET_MATRIX[mode][targeting].length > 0) {
      result.push(targeting);
    }
  }
  return Object.freeze(result);
}

/**
 * Returns all targeting classes reachable by a given deck type, taking the
 * union across all four modes from `DECK_TARGET_DOCTRINE`.
 */
export function getTargetingsByDeckType(deckType: DeckType): readonly Targeting[] {
  const doctrine = DECK_TARGET_DOCTRINE[deckType];
  const union: Targeting[] = [];
  for (const mode of Object.keys(doctrine) as ModeCode[]) {
    for (const t of doctrine[mode]) {
      union.push(t);
    }
  }
  return uniqueTargetings(union);
}

/**
 * Returns all targeting classes reachable by a timing class, taking the
 * union across all four modes from `TIMING_TARGET_DOCTRINE`.
 */
export function getTargetingsByTimingClass(timingClass: TimingClass): readonly Targeting[] {
  const doctrine = TIMING_TARGET_DOCTRINE[timingClass];
  const union: Targeting[] = [];
  for (const mode of Object.keys(doctrine) as ModeCode[]) {
    for (const t of doctrine[mode]) {
      union.push(t);
    }
  }
  return uniqueTargetings(union);
}

/** True if the targeting class requires a cooperative lane to be meaningful. */
export function isCoopOnlyTarget(targeting: Targeting): boolean {
  return targeting === 'TEAMMATE' || targeting === 'TEAM';
}

/** True if the targeting class requires a live opponent lane. */
export function isPvpOnlyTarget(targeting: Targeting): boolean {
  return targeting === 'OPPONENT';
}

/** True if the targeting class is self-directed. */
export function isSelfTarget(targeting: Targeting): boolean {
  return targeting === 'SELF';
}

/** True if the targeting class is system-wide. */
export function isGlobalTarget(targeting: Targeting): boolean {
  return targeting === 'GLOBAL';
}

/** Returns the deck doctrine targeting list for a deck type in a specific mode. */
export function unionDeckModeTargetings(deckType: DeckType, mode: ModeCode): readonly Targeting[] {
  return DECK_TARGET_DOCTRINE[deckType][mode];
}

/** Returns the union of targeting classes across ALL modes for a deck type. */
export function unionDeckAllModesTargetings(deckType: DeckType): readonly Targeting[] {
  const doctrine = DECK_TARGET_DOCTRINE[deckType];
  const lists = (Object.keys(doctrine) as ModeCode[]).map((mode) => doctrine[mode]);
  return unionTargetings(...lists);
}

/** Returns the timing doctrine targeting list for a timing class in a specific mode. */
export function unionTimingModeTargetings(timingClass: TimingClass, mode: ModeCode): readonly Targeting[] {
  return TIMING_TARGET_DOCTRINE[timingClass][mode];
}

/** Returns the union of targeting classes across ALL modes for a timing class. */
export function unionTimingAllModesTargetings(timingClass: TimingClass): readonly Targeting[] {
  const doctrine = TIMING_TARGET_DOCTRINE[timingClass];
  const lists = (Object.keys(doctrine) as ModeCode[]).map((mode) => doctrine[mode]);
  return unionTargetings(...lists);
}

/** Returns the mode targeting summary label for narration surfaces. */
export function getModeTargetingSummary(mode: ModeCode): string {
  return MODE_SUMMARY[mode];
}

/** Returns the deck targeting summary label for narration surfaces. */
export function getDeckTargetingSummary(deckType: DeckType): string {
  return DECK_SUMMARY[deckType];
}

/** Returns all timing classes that are only active in cooperative (coop) mode. */
export function listCoopExclusiveTimingClasses(): readonly TimingClass[] {
  return Object.freeze(['RES', 'AID'] as const);
}

/** Returns all timing classes that are PvP reaction timing classes. */
export function listPvpReactionTimingClasses(): readonly TimingClass[] {
  return Object.freeze(['CTR'] as const);
}

/** Returns all timing classes that are ghost-mode-exclusive. */
export function listGhostExclusiveTimingClasses(): readonly TimingClass[] {
  return Object.freeze(['GBM'] as const);
}

/** Returns all deck types that are coop-exclusive (no targeting in pvp/solo/ghost). */
export function listCoopExclusiveDeckTypes(): readonly DeckType[] {
  return Object.freeze(['AID', 'RESCUE', 'TRUST'] as const);
}

/** Returns all deck types that are pvp-exclusive (no targeting outside pvp). */
export function listPvpExclusiveDeckTypes(): readonly DeckType[] {
  return Object.freeze(['SABOTAGE', 'BLUFF'] as const);
}

/** Returns all deck types that are ghost-mode-exclusive. */
export function listGhostExclusiveDeckTypes(): readonly DeckType[] {
  return Object.freeze(['GHOST'] as const);
}

/**
 * Returns whether a given DeckType has any reachable target class in the
 * given mode from pure deck doctrine — does not account for runtime gating.
 */
export function isDeckTypePlayableInMode(deckType: DeckType, mode: ModeCode): boolean {
  return DECK_TARGET_DOCTRINE[deckType][mode].length > 0;
}

/**
 * Returns whether a TimingClass requires an active decision window to be
 * legal (as opposed to being always-evaluatable from snapshot context alone).
 */
export function isTimingClassWindowDependent(timingClass: TimingClass): boolean {
  return (
    timingClass === 'CTR' ||
    timingClass === 'RES' ||
    timingClass === 'AID' ||
    timingClass === 'GBM' ||
    timingClass === 'CAS' ||
    timingClass === 'PHZ'
  );
}

/** Returns the canonical timing order index for a TimingClass (for sorting). */
export function getTimingClassOrderIndex(timingClass: TimingClass): number {
  const TIMING_ORDER_MAP: Readonly<Record<TimingClass, number>> = Object.freeze({
    PRE: 0,
    POST: 1,
    FATE: 2,
    CTR: 3,
    RES: 4,
    AID: 5,
    GBM: 6,
    CAS: 7,
    PHZ: 8,
    PSK: 9,
    END: 10,
    ANY: 11,
  });
  return TIMING_ORDER_MAP[timingClass];
}

/** Sorts targeting classes by their position in `ALL_TARGETINGS` canonical order. */
export function sortTargetingsByCanonicalOrder(targetings: readonly Targeting[]): readonly Targeting[] {
  return Object.freeze(
    [...targetings].sort(
      (a, b) => ALL_TARGETINGS.indexOf(a) - ALL_TARGETINGS.indexOf(b),
    ),
  );
}

/** Returns whether two targeting arrays are set-equivalent (same members, any order). */
export function targetingsAreEquivalent(
  a: readonly Targeting[],
  b: readonly Targeting[],
): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const setA = new Set<Targeting>(a);
  for (const t of b) {
    if (!setA.has(t)) {
      return false;
    }
  }
  return true;
}

/**
 * Returns the targeting coverage score (0–1) for a card in the current snapshot.
 * A score of 1.0 means all 5 targeting classes are reachable.
 */
export function computeTargetingCoverageScore(
  snapshot: RunStateSnapshot,
  card: CardInstance,
): number {
  const allowed = new CardTargetingResolver().resolveAllowedTargets(snapshot, card);
  return allowed.length / ALL_TARGETINGS.length;
}

/**
 * Returns a human-readable, mode-native label for a targeting class.
 * Suitable for UX tooltips and chat narration.
 */
export function getTargetingLabel(targeting: Targeting, mode: ModeCode): string {
  const labels: Readonly<Record<ModeCode, Readonly<Record<Targeting, string>>>> = Object.freeze({
    solo: Object.freeze({
      SELF: 'Your Empire',
      OPPONENT: 'No opponent lane (Empire)',
      TEAMMATE: 'No teammate lane (Empire)',
      TEAM: 'No team lane (Empire)',
      GLOBAL: 'All systems',
    }),
    pvp: Object.freeze({
      SELF: 'Your position',
      OPPONENT: 'Opponent position',
      TEAMMATE: 'No teammate lane (Predator)',
      TEAM: 'No team lane (Predator)',
      GLOBAL: 'All combatants',
    }),
    coop: Object.freeze({
      SELF: 'Your position',
      OPPONENT: 'No opponent lane (Syndicate)',
      TEAMMATE: 'Specific teammate',
      TEAM: 'Full team',
      GLOBAL: 'All Syndicate',
    }),
    ghost: Object.freeze({
      SELF: 'Your Phantom run',
      OPPONENT: 'No opponent lane (Ghost)',
      TEAMMATE: 'No teammate lane (Ghost)',
      TEAM: 'No team lane (Ghost)',
      GLOBAL: 'Legend system',
    }),
  });
  return labels[mode][targeting];
}

/**
 * Returns a short UX-ready status badge for a target class allowance result.
 * Suitable for icon overlay labels and card-frame tinting.
 */
export function getTargetingStatusBadge(allowance: TargetAllowance): string {
  if (allowance.allowed) {
    return allowance.reasons.includes('TARGET_ALLOWED_AFTER_CANONICALIZATION')
      ? 'ALLOWED_CANONICAL'
      : 'ALLOWED';
  }
  if (allowance.allowedTargets.length === 0) {
    return 'BLOCKED_NO_TARGET';
  }
  return 'BLOCKED_WRONG_TARGET';
}

/**
 * Returns the first blocking reason code from an allowance result, or null
 * if the targeting was allowed. Useful for surfacing the primary block reason
 * in UX tooltips without listing all reason codes.
 */
export function getFirstBlockingReason(allowance: TargetAllowance): TargetReasonCode | null {
  if (allowance.allowed) {
    return null;
  }
  return (
    allowance.reasons.find(
      (r) =>
        r !== 'TARGET_SUPPORTED' &&
        r !== 'TARGET_ALLOWED_AFTER_CANONICALIZATION',
    ) ?? null
  );
}

/**
 * Returns a player-facing explanation string for the first blocking reason,
 * formatted for inline UX display (not the full summary).
 */
export function explainBlockingReason(reason: TargetReasonCode): string {
  const EXPLANATIONS: Readonly<Record<TargetReasonCode, string>> = Object.freeze({
    TARGET_SUPPORTED: 'Target class supported.',
    TARGET_NOT_IN_BASE_MODE_MATRIX: 'This target class is not available in this mode.',
    TARGET_NOT_IN_CARD_CLASS_MATRIX: 'This card type cannot reach this target class.',
    TARGET_NOT_IN_DECK_DOCTRINE: 'Deck doctrine does not allow this target class here.',
    TARGET_NOT_IN_TIMING_DOCTRINE: 'Timing doctrine narrows this card away from this target.',
    TARGET_NOT_IN_TAG_DOCTRINE: 'Card tags restrict this targeting direction.',
    TARGET_BLOCKED_BY_COUNTER_WINDOW_REQUIREMENT: 'Counter window is not active.',
    TARGET_BLOCKED_BY_RESCUE_WINDOW_REQUIREMENT: 'Rescue window is not active.',
    TARGET_BLOCKED_BY_AID_WINDOW_REQUIREMENT: 'Aid window is not active.',
    TARGET_BLOCKED_BY_PHASE_BOUNDARY_REQUIREMENT: 'No phase boundary window is open.',
    TARGET_BLOCKED_BY_CASCADE_WINDOW_REQUIREMENT: 'No cascade window or active chain.',
    TARGET_BLOCKED_BY_GHOST_MARKER_REQUIREMENT: 'Ghost marker lane is not active.',
    TARGET_BLOCKED_BY_SHARED_TREASURY_REQUIREMENT: 'No shared treasury lane.',
    TARGET_BLOCKED_BY_COOP_CONTEXT_REQUIREMENT: 'No cooperative lane is active.',
    TARGET_BLOCKED_BY_PVP_CONTEXT_REQUIREMENT: 'No opponent lane is active.',
    TARGET_BLOCKED_BY_GHOST_CONTEXT_REQUIREMENT: 'Ghost mode is not active.',
    TARGET_BLOCKED_BY_EXTRACTION_CONTEXT_REQUIREMENT: 'No extraction pressure is active.',
    TARGET_BLOCKED_BY_COUNTER_INTEL_REQUIREMENT: 'Counter-intel lane is not active.',
    TARGET_BLOCKED_BY_DISABLED_BOT_CONTEXT: 'Bot context prevents this target.',
    TARGET_BLOCKED_BY_ROLE_LOCK: 'Role lock prevents this target direction.',
    TARGET_BLOCKED_BY_WARNING_QUARANTINE: 'Runtime is in a warning quarantine state.',
    TARGET_BLOCKED_BY_OUTCOME_FINALIZED: 'Run outcome has already been finalized.',
    TARGET_BLOCKED_BY_CARD_STATE: 'Card decay has expired.',
    TARGET_BLOCKED_BY_REQUEST_CANONICALIZATION: 'Target class shape mismatch with card base.',
    TARGET_BLOCKED_BY_CARD_DOCTRINE: 'Named-card doctrine overrides this target class.',
    TARGET_BLOCKED_BY_MODE_DOCTRINE: 'Mode doctrine hard-blocks this target class.',
    TARGET_BLOCKED_BY_RUNTIME_RULE: 'Runtime rule prevents this target class.',
    TARGET_ALLOWED_AFTER_CANONICALIZATION: 'Target allowed after canonical rewrite.',
  });
  return EXPLANATIONS[reason] ?? `Unknown block reason: ${reason}`;
}

/* ──────────────────────────────────────────────────────────────────────────────
 * Module authority object
 * ──────────────────────────────────────────────────────────────────────────── */

export const CARD_TARGETING_RESOLVER_MODULE_AUTHORITY = Object.freeze({
  module: 'CardTargetingResolver',
  version: '2.0.0',
  surface: 'engine/cards/targeting',
  exports: Object.freeze([
    'CardTargetingResolver',
    'CARD_TARGETING_DOCTRINE',
    'TargetingBatchResult',
    'TargetingHandSummary',
    'TargetingAdvisory',
    'TargetingDiagnosticReport',
    'getBaseModeTargetMatrix',
    'getDeckTargetDoctrine',
    'getTimingTargetDoctrine',
    'getTagTargetDoctrine',
    'projectTargetWindows',
    'projectTargetModeContext',
    'projectTargetCardContext',
    'deriveAllowedTargetsForCard',
    'canResolveTargetClass',
    'cardRepresentsPredatorPressure',
    'cardRepresentsSyndicateRescue',
    'cardRepresentsSyndicateAid',
    'cardRepresentsGhostInstrumentation',
    'cardRepresentsPhaseBoundaryMacroDecision',
    'cardRepresentsCascadeIntervention',
    'cardRequiresSharedTreasuryLane',
    'cardRequiresCounterIntelLane',
    'cardRequiresLegendLane',
    'cardRequiresExtractionLane',
    'cardTargetNarrativeLabel',
    'hasCompleteModeMatrixCoverage',
    'hasCompleteDeckDoctrineCoverage',
    'hasCompleteTimingDoctrineCoverage',
    'assertTargetDoctrineHealthy',
    'warmCardTargetingDoctrine',
    'listAllTargetings',
    'getTargetingsByMode',
    'getTargetingsByDeckType',
    'getTargetingsByTimingClass',
    'isCoopOnlyTarget',
    'isPvpOnlyTarget',
    'isSelfTarget',
    'isGlobalTarget',
    'unionDeckModeTargetings',
    'unionDeckAllModesTargetings',
    'unionTimingModeTargetings',
    'unionTimingAllModesTargetings',
    'getModeTargetingSummary',
    'getDeckTargetingSummary',
    'listCoopExclusiveTimingClasses',
    'listPvpReactionTimingClasses',
    'listGhostExclusiveTimingClasses',
    'listCoopExclusiveDeckTypes',
    'listPvpExclusiveDeckTypes',
    'listGhostExclusiveDeckTypes',
    'isDeckTypePlayableInMode',
    'isTimingClassWindowDependent',
    'getTimingClassOrderIndex',
    'sortTargetingsByCanonicalOrder',
    'targetingsAreEquivalent',
    'computeTargetingCoverageScore',
    'getTargetingLabel',
    'getTargetingStatusBadge',
    'getFirstBlockingReason',
    'explainBlockingReason',
    'CARD_TARGETING_RESOLVER_MODULE_AUTHORITY',
  ] as const),
});
