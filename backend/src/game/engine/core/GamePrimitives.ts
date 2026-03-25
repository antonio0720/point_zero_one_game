/*
 * POINT ZERO ONE — BACKEND ENGINE CORE
 * /backend/src/game/engine/core/GamePrimitives.ts
 *
 * Doctrine:
 * - this file is the canonical shared primitive surface for backend simulation
 * - types here must be mode-aware, engine-safe, and serialization-friendly
 * - additive extensibility is preferred over breaking renames
 * - cards, attacks, threats, overlays, and proof events remain backend-owned
 * - every constant, function, and class here is consumed by engines or adapters
 * - ML/DL feature extraction is a first-class concern at every level
 * - user experience scoring drives all analytical surfaces
 */

// ============================================================================
// MARK: Core union types — the canonical vocabulary of game state
// ============================================================================

export type ModeCode = 'solo' | 'pvp' | 'coop' | 'ghost';
export type PressureTier = 'T0' | 'T1' | 'T2' | 'T3' | 'T4';
export type RunPhase = 'FOUNDATION' | 'ESCALATION' | 'SOVEREIGNTY';
export type RunOutcome = 'FREEDOM' | 'TIMEOUT' | 'BANKRUPT' | 'ABANDONED';

export type ShieldLayerId = 'L1' | 'L2' | 'L3' | 'L4';
export type ShieldLayerLabel =
  | 'CASH_RESERVE'
  | 'CREDIT_LINE'
  | 'INCOME_BASE'
  | 'NETWORK_CORE';

export type HaterBotId = 'BOT_01' | 'BOT_02' | 'BOT_03' | 'BOT_04' | 'BOT_05';
export type BotState =
  | 'DORMANT'
  | 'WATCHING'
  | 'TARGETING'
  | 'ATTACKING'
  | 'RETREATING'
  | 'NEUTRALIZED';

export type Targeting = 'SELF' | 'OPPONENT' | 'TEAMMATE' | 'TEAM' | 'GLOBAL';
export type Counterability = 'NONE' | 'SOFT' | 'HARD';

export type TimingClass =
  | 'PRE'
  | 'POST'
  | 'FATE'
  | 'CTR'
  | 'RES'
  | 'AID'
  | 'GBM'
  | 'CAS'
  | 'PHZ'
  | 'PSK'
  | 'END'
  | 'ANY';

export type DeckType =
  | 'OPPORTUNITY'
  | 'IPA'
  | 'FUBAR'
  | 'MISSED_OPPORTUNITY'
  | 'PRIVILEGED'
  | 'SO'
  | 'SABOTAGE'
  | 'COUNTER'
  | 'AID'
  | 'RESCUE'
  | 'DISCIPLINE'
  | 'TRUST'
  | 'BLUFF'
  | 'GHOST';

export type VisibilityLevel = 'HIDDEN' | 'SILHOUETTE' | 'PARTIAL' | 'EXPOSED';
export type DivergencePotential = 'LOW' | 'MEDIUM' | 'HIGH';
export type IntegrityStatus = 'PENDING' | 'VERIFIED' | 'QUARANTINED' | 'UNVERIFIED';
export type AttackCategory = 'EXTRACTION' | 'LOCK' | 'DRAIN' | 'HEAT' | 'BREACH' | 'DEBT';
export type CardRarity = 'COMMON' | 'UNCOMMON' | 'RARE' | 'LEGENDARY';
export type VerifiedGrade = 'A' | 'B' | 'C' | 'D' | 'F';
export type AttackTargetEntity = 'SELF' | 'OPPONENT' | 'TEAM' | 'PLAYER';

// ============================================================================
// MARK: Canonical constant arrays — used by type guards and analytics
// ============================================================================

export const MODE_CODES = ['solo', 'pvp', 'coop', 'ghost'] as const;
export const PRESSURE_TIERS = ['T0', 'T1', 'T2', 'T3', 'T4'] as const;
export const RUN_PHASES = ['FOUNDATION', 'ESCALATION', 'SOVEREIGNTY'] as const;
export const RUN_OUTCOMES = ['FREEDOM', 'TIMEOUT', 'BANKRUPT', 'ABANDONED'] as const;
export const SHIELD_LAYER_IDS = ['L1', 'L2', 'L3', 'L4'] as const;
export const HATER_BOT_IDS = ['BOT_01', 'BOT_02', 'BOT_03', 'BOT_04', 'BOT_05'] as const;
export const TIMING_CLASSES = [
  'PRE', 'POST', 'FATE', 'CTR', 'RES', 'AID', 'GBM',
  'CAS', 'PHZ', 'PSK', 'END', 'ANY',
] as const;
export const DECK_TYPES = [
  'OPPORTUNITY', 'IPA', 'FUBAR', 'MISSED_OPPORTUNITY', 'PRIVILEGED',
  'SO', 'SABOTAGE', 'COUNTER', 'AID', 'RESCUE', 'DISCIPLINE',
  'TRUST', 'BLUFF', 'GHOST',
] as const;
export const VISIBILITY_LEVELS = ['HIDDEN', 'SILHOUETTE', 'PARTIAL', 'EXPOSED'] as const;
export const INTEGRITY_STATUSES = ['PENDING', 'VERIFIED', 'QUARANTINED', 'UNVERIFIED'] as const;
export const VERIFIED_GRADES = ['A', 'B', 'C', 'D', 'F'] as const;

export const SHIELD_LAYER_LABEL_BY_ID: Record<ShieldLayerId, ShieldLayerLabel> = {
  L1: 'CASH_RESERVE',
  L2: 'CREDIT_LINE',
  L3: 'INCOME_BASE',
  L4: 'NETWORK_CORE',
};

// ============================================================================
// MARK: Derived analytics constants — used in scoring, ML, and UX modeling
// ============================================================================

/**
 * Normalized 0-1 value for each pressure tier.
 * Used in ML feature extraction and UX risk scoring.
 */
export const PRESSURE_TIER_NORMALIZED: Record<PressureTier, number> = {
  T0: 0.0,
  T1: 0.25,
  T2: 0.5,
  T3: 0.75,
  T4: 1.0,
};

/**
 * Human-readable urgency label per tier. Drives NPC dialog and chat signal severity.
 */
export const PRESSURE_TIER_URGENCY_LABEL: Record<PressureTier, string> = {
  T0: 'Calm',
  T1: 'Building',
  T2: 'Elevated',
  T3: 'Critical',
  T4: 'Apex',
};

/**
 * Minimum ticks that must pass in a tier before escalation is considered.
 */
export const PRESSURE_TIER_MIN_HOLD_TICKS: Record<PressureTier, number> = {
  T0: 0,
  T1: 3,
  T2: 2,
  T3: 1,
  T4: 0,
};

/**
 * Escalation threshold score for transitioning INTO each tier.
 */
export const PRESSURE_TIER_ESCALATION_THRESHOLD: Record<PressureTier, number> = {
  T0: 0,
  T1: 20,
  T2: 45,
  T3: 70,
  T4: 90,
};

/**
 * De-escalation threshold score for dropping OUT of each tier.
 */
export const PRESSURE_TIER_DEESCALATION_THRESHOLD: Record<PressureTier, number> = {
  T0: -1,
  T1: 10,
  T2: 35,
  T3: 60,
  T4: 80,
};

/**
 * Normalized 0-1 value for each run phase.
 */
export const RUN_PHASE_NORMALIZED: Record<RunPhase, number> = {
  FOUNDATION: 0.0,
  ESCALATION: 0.5,
  SOVEREIGNTY: 1.0,
};

/**
 * Stakes multiplier per phase — how much each action matters.
 */
export const RUN_PHASE_STAKES_MULTIPLIER: Record<RunPhase, number> = {
  FOUNDATION: 0.6,
  ESCALATION: 0.85,
  SOVEREIGNTY: 1.0,
};

/**
 * Tick budget fraction allocated to each phase (sum = 1.0).
 */
export const RUN_PHASE_TICK_BUDGET_FRACTION: Record<RunPhase, number> = {
  FOUNDATION: 0.35,
  ESCALATION: 0.40,
  SOVEREIGNTY: 0.25,
};

/**
 * Normalized 0-1 value for each mode code.
 */
export const MODE_NORMALIZED: Record<ModeCode, number> = {
  solo: 0.0,
  pvp: 0.33,
  coop: 0.67,
  ghost: 1.0,
};

/**
 * Base difficulty multiplier per mode. Higher = harder for user.
 */
export const MODE_DIFFICULTY_MULTIPLIER: Record<ModeCode, number> = {
  solo: 1.0,
  pvp: 1.4,
  coop: 0.9,
  ghost: 1.6,
};

/**
 * Tension floor per mode — minimum tension score the system targets.
 */
export const MODE_TENSION_FLOOR: Record<ModeCode, number> = {
  solo: 0.15,
  pvp: 0.35,
  coop: 0.20,
  ghost: 0.50,
};

/**
 * Maximum allowed divergence potential per mode.
 */
export const MODE_MAX_DIVERGENCE: Record<ModeCode, DivergencePotential> = {
  solo: 'MEDIUM',
  pvp: 'HIGH',
  coop: 'LOW',
  ghost: 'HIGH',
};

/**
 * Absorption priority order for shield layers (L1 absorbs first).
 */
export const SHIELD_LAYER_ABSORPTION_ORDER: readonly ShieldLayerId[] = [
  'L1', 'L2', 'L3', 'L4',
] as const;

/**
 * Intrinsic regeneration rate per layer (HP per tick).
 */
export const SHIELD_LAYER_REGEN_RATE: Record<ShieldLayerId, number> = {
  L1: 0.5,
  L2: 0.3,
  L3: 0.2,
  L4: 0.1,
};

/**
 * Maximum capacity factor per layer — relative max HP weight.
 */
export const SHIELD_LAYER_CAPACITY_WEIGHT: Record<ShieldLayerId, number> = {
  L1: 1.0,
  L2: 0.75,
  L3: 0.6,
  L4: 0.5,
};

/**
 * Window priority per timing class. Higher = processed first when multiple are open.
 */
export const TIMING_CLASS_WINDOW_PRIORITY: Record<TimingClass, number> = {
  FATE: 100,
  CTR:  90,
  END:  85,
  PHZ:  80,
  PSK:  75,
  CAS:  70,
  RES:  60,
  AID:  55,
  GBM:  50,
  PRE:  40,
  POST: 30,
  ANY:  10,
};

/**
 * Urgency decay factor per tick for each timing class (0 = no decay, 1 = instant).
 */
export const TIMING_CLASS_URGENCY_DECAY: Record<TimingClass, number> = {
  FATE: 0.0,
  CTR:  0.25,
  END:  0.0,
  PHZ:  0.1,
  PSK:  0.1,
  CAS:  0.15,
  RES:  0.2,
  AID:  0.2,
  GBM:  0.05,
  PRE:  0.3,
  POST: 0.35,
  ANY:  0.4,
};

/**
 * Power level 0-1 per deck type — how much raw impact this deck has.
 */
export const DECK_TYPE_POWER_LEVEL: Record<DeckType, number> = {
  OPPORTUNITY:       0.8,
  IPA:               0.7,
  FUBAR:             0.3,
  MISSED_OPPORTUNITY: 0.25,
  PRIVILEGED:        0.9,
  SO:                0.65,
  SABOTAGE:          0.85,
  COUNTER:           0.75,
  AID:               0.6,
  RESCUE:            0.55,
  DISCIPLINE:        0.5,
  TRUST:             0.45,
  BLUFF:             0.5,
  GHOST:             0.95,
};

/**
 * Whether a deck type tends to be used offensively vs defensively.
 */
export const DECK_TYPE_IS_OFFENSIVE: Record<DeckType, boolean> = {
  OPPORTUNITY:        true,
  IPA:                true,
  FUBAR:              false,
  MISSED_OPPORTUNITY: false,
  PRIVILEGED:         true,
  SO:                 true,
  SABOTAGE:           true,
  COUNTER:            false,
  AID:                false,
  RESCUE:             false,
  DISCIPLINE:         false,
  TRUST:              false,
  BLUFF:              true,
  GHOST:              true,
};

/**
 * Base magnitude of each attack category (normalized 0-1).
 */
export const ATTACK_CATEGORY_BASE_MAGNITUDE: Record<AttackCategory, number> = {
  EXTRACTION: 0.8,
  LOCK:       0.6,
  DRAIN:      0.7,
  HEAT:       0.5,
  BREACH:     0.9,
  DEBT:       0.75,
};

/**
 * Whether an attack category can be counter-played with a COUNTER card.
 */
export const ATTACK_CATEGORY_IS_COUNTERABLE: Record<AttackCategory, boolean> = {
  EXTRACTION: true,
  LOCK:       false,
  DRAIN:      true,
  HEAT:       false,
  BREACH:     true,
  DEBT:       true,
};

/**
 * Threat multiplier for each HaterBot. BOT_05 is the most dangerous.
 */
export const BOT_THREAT_LEVEL: Record<HaterBotId, number> = {
  BOT_01: 0.2,
  BOT_02: 0.4,
  BOT_03: 0.6,
  BOT_04: 0.75,
  BOT_05: 1.0,
};

/**
 * Multiplier on bot threat contribution per bot state.
 */
export const BOT_STATE_THREAT_MULTIPLIER: Record<BotState, number> = {
  DORMANT:     0.0,
  WATCHING:    0.1,
  TARGETING:   0.4,
  ATTACKING:   1.0,
  RETREATING:  0.2,
  NEUTRALIZED: 0.0,
};

/**
 * Allowed state transitions for bots (from → set of allowed next states).
 */
export const BOT_STATE_ALLOWED_TRANSITIONS: Record<BotState, readonly BotState[]> = {
  DORMANT:     ['WATCHING'],
  WATCHING:    ['TARGETING', 'DORMANT'],
  TARGETING:   ['ATTACKING', 'RETREATING'],
  ATTACKING:   ['RETREATING', 'NEUTRALIZED'],
  RETREATING:  ['DORMANT', 'WATCHING'],
  NEUTRALIZED: [],
};

/**
 * Concealment factor per visibility level. 1.0 = fully hidden, 0.0 = fully exposed.
 */
export const VISIBILITY_CONCEALMENT_FACTOR: Record<VisibilityLevel, number> = {
  HIDDEN:     1.0,
  SILHOUETTE: 0.7,
  PARTIAL:    0.35,
  EXPOSED:    0.0,
};

/**
 * Risk contribution per integrity status.
 */
export const INTEGRITY_STATUS_RISK_SCORE: Record<IntegrityStatus, number> = {
  PENDING:      0.5,
  VERIFIED:     0.0,
  QUARANTINED:  0.9,
  UNVERIFIED:   0.7,
};

/**
 * Numeric score per verified grade (A=1.0 → F=0.0).
 */
export const VERIFIED_GRADE_NUMERIC_SCORE: Record<VerifiedGrade, number> = {
  A: 1.0,
  B: 0.75,
  C: 0.5,
  D: 0.25,
  F: 0.0,
};

/**
 * Rarity weight factor for card power calculations.
 */
export const CARD_RARITY_WEIGHT: Record<CardRarity, number> = {
  COMMON:    1.0,
  UNCOMMON:  1.5,
  RARE:      2.25,
  LEGENDARY: 4.0,
};

/**
 * Divergence potential normalized (0-1).
 */
export const DIVERGENCE_POTENTIAL_NORMALIZED: Record<DivergencePotential, number> = {
  LOW:    0.0,
  MEDIUM: 0.5,
  HIGH:   1.0,
};

/**
 * Counterability score 0-1 — how easily a card can be countered.
 */
export const COUNTERABILITY_RESISTANCE_SCORE: Record<Counterability, number> = {
  NONE: 1.0,
  SOFT: 0.5,
  HARD: 0.0,
};

/**
 * Targeting spread factor — how many entities are affected.
 */
export const TARGETING_SPREAD_FACTOR: Record<Targeting, number> = {
  SELF:     0.1,
  OPPONENT: 0.5,
  TEAMMATE: 0.5,
  TEAM:     0.75,
  GLOBAL:   1.0,
};

// ============================================================================
// MARK: Core domain interfaces
// ============================================================================

export interface EffectPayload {
  cashDelta?: number;
  debtDelta?: number;
  incomeDelta?: number;
  expenseDelta?: number;
  shieldDelta?: number;
  heatDelta?: number;
  trustDelta?: number;
  treasuryDelta?: number;
  battleBudgetDelta?: number;
  holdChargeDelta?: number;
  counterIntelDelta?: number;
  timeDeltaMs?: number;
  divergenceDelta?: number;
  cascadeTag?: string | null;
  injectCards?: string[];
  exhaustCards?: string[];
  grantBadges?: string[];
  namedActionId?: string | null;
}

export interface ModeOverlay {
  costModifier: number;
  effectModifier: number;
  tagWeights: Record<string, number>;
  timingLock: readonly TimingClass[];
  legal: boolean;
  targetingOverride?: Targeting;
  divergencePotential?: DivergencePotential;
}

export type ModeOverlayPatch = Partial<ModeOverlay>;
export type ModeOverlayMap = Partial<Record<ModeCode, ModeOverlayPatch>>;

export interface CardDefinition {
  id: string;
  name: string;
  deckType: DeckType;
  baseCost: number;
  baseEffect: EffectPayload;
  tags: string[];
  timingClass: TimingClass[];
  rarity: CardRarity;
  autoResolve: boolean;
  counterability: Counterability;
  targeting: Targeting;
  decisionTimerOverrideMs: number | null;
  decayTicks: number | null;
  modeLegal: ModeCode[];
  modeOverlay?: ModeOverlayMap;
  educationalTag: string;
}

export interface CardInstance {
  instanceId: string;
  definitionId: string;
  card: CardDefinition;
  cost: number;
  targeting: Targeting;
  timingClass: TimingClass[];
  tags: string[];
  overlayAppliedForMode: ModeCode;
  decayTicksRemaining: number | null;
  divergencePotential: DivergencePotential;
}

export interface AttackEvent {
  attackId: string;
  source: HaterBotId | 'OPPONENT' | 'SYSTEM';
  targetEntity: AttackTargetEntity;
  targetLayer: ShieldLayerId | 'DIRECT';
  category: AttackCategory;
  magnitude: number;
  createdAtTick: number;
  notes: string[];
}

export interface ThreatEnvelope {
  threatId: string;
  source: string;
  etaTicks: number;
  severity: number;
  visibleAs: VisibilityLevel;
  summary: string;
}

export interface CascadeLink {
  linkId: string;
  scheduledTick: number;
  effect: EffectPayload;
  summary: string;
}

export interface CascadeChainInstance {
  chainId: string;
  templateId: string;
  trigger: string;
  positive: boolean;
  status: 'ACTIVE' | 'BROKEN' | 'COMPLETED';
  createdAtTick: number;
  links: CascadeLink[];
  recoveryTags: string[];
}

export interface LegendMarker {
  markerId: string;
  tick: number;
  kind: 'GOLD' | 'RED' | 'PURPLE' | 'SILVER' | 'BLACK';
  cardId: string | null;
  summary: string;
}

// ============================================================================
// MARK: EngineEventMap — canonical event vocabulary
// ============================================================================

export interface EngineEventMap {
  'run.started': {
    runId: string;
    mode: ModeCode;
    seed: string;
  };
  'tick.started': {
    runId: string;
    tick: number;
    phase: RunPhase;
  };
  'tick.completed': {
    runId: string;
    tick: number;
    phase: RunPhase;
    checksum: string;
  };
  'pressure.changed': {
    from: PressureTier;
    to: PressureTier;
    score: number;
  };
  'tension.updated': {
    score: number;
    visibleThreats: number;
  };
  'threat.routed': {
    threatId: string;
    source: string;
    category: AttackCategory;
    targetLayer: ShieldLayerId | 'DIRECT';
    targetEntity: AttackTargetEntity;
  };
  'battle.attack.injected': {
    attack: AttackEvent;
  };
  'battle.bot.state_changed': {
    botId: HaterBotId;
    from: BotState;
    to: BotState;
    tick: number;
  };
  'shield.breached': {
    attackId: string;
    layerId: ShieldLayerId;
    tick: number;
    cascadesTriggered: number;
  };
  'cascade.chain.created': {
    chainId: string;
    templateId: string;
    positive: boolean;
  };
  'cascade.chain.progressed': {
    chainId: string;
    linkId: string;
    tick: number;
  };
  'card.played': {
    runId: string;
    actorId: string;
    cardId: string;
    tick: number;
    mode: ModeCode;
  };
  'mode.defection.progressed': {
    playerId: string;
    step: number;
    cardId: string;
  };
  'mode.phase_window.opened': {
    mode: ModeCode;
    tick: number;
    timing: TimingClass;
    remaining: number;
  };
  'decision.window.opened': {
    windowId: string;
    tick: number;
    durationMs: number;
    actorId?: string;
  };
  'decision.window.closed': {
    windowId: string;
    tick: number;
    accepted: boolean;
    actorId?: string;
  };
  'integrity.quarantined': {
    runId: string;
    tick: number;
    reasons: string[];
  };
  'proof.sealed': {
    runId: string;
    proofHash: string;
    integrityStatus: IntegrityStatus;
    grade: VerifiedGrade | string;
    outcome: RunOutcome;
  };
  'sovereignty.completed': {
    runId: string;
    score: number;
    grade: string;
    proofHash: string;
    outcome: RunOutcome;
  };
}

// ============================================================================
// MARK: Default values and factory state
// ============================================================================

export const DEFAULT_MODE_OVERLAY: Readonly<ModeOverlay> = Object.freeze({
  costModifier: 1,
  effectModifier: 1,
  tagWeights: Object.freeze({}),
  timingLock: Object.freeze([]),
  legal: true,
});

// ============================================================================
// MARK: Type guards — runtime validation of canonical union types
// ============================================================================

export function isModeCode(value: unknown): value is ModeCode {
  return typeof value === 'string' && (MODE_CODES as readonly string[]).includes(value);
}

export function isPressureTier(value: unknown): value is PressureTier {
  return typeof value === 'string' && (PRESSURE_TIERS as readonly string[]).includes(value);
}

export function isRunPhase(value: unknown): value is RunPhase {
  return typeof value === 'string' && (RUN_PHASES as readonly string[]).includes(value);
}

export function isRunOutcome(value: unknown): value is RunOutcome {
  return typeof value === 'string' && (RUN_OUTCOMES as readonly string[]).includes(value);
}

export function isShieldLayerId(value: unknown): value is ShieldLayerId {
  return typeof value === 'string' && (SHIELD_LAYER_IDS as readonly string[]).includes(value);
}

export function isHaterBotId(value: unknown): value is HaterBotId {
  return typeof value === 'string' && (HATER_BOT_IDS as readonly string[]).includes(value);
}

export function isTimingClass(value: unknown): value is TimingClass {
  return typeof value === 'string' && (TIMING_CLASSES as readonly string[]).includes(value);
}

export function isDeckType(value: unknown): value is DeckType {
  return typeof value === 'string' && (DECK_TYPES as readonly string[]).includes(value);
}

export function isVisibilityLevel(value: unknown): value is VisibilityLevel {
  return typeof value === 'string' && (VISIBILITY_LEVELS as readonly string[]).includes(value);
}

export function isIntegrityStatus(value: unknown): value is IntegrityStatus {
  return (
    typeof value === 'string' &&
    (INTEGRITY_STATUSES as readonly string[]).includes(value)
  );
}

export function isVerifiedGrade(value: unknown): value is VerifiedGrade {
  return typeof value === 'string' && (VERIFIED_GRADES as readonly string[]).includes(value);
}

// ============================================================================
// MARK: Core factory utilities
// ============================================================================

export function normalizeModeOverlay(
  overlay?: ModeOverlayPatch | null,
): ModeOverlay {
  return {
    costModifier: overlay?.costModifier ?? DEFAULT_MODE_OVERLAY.costModifier,
    effectModifier: overlay?.effectModifier ?? DEFAULT_MODE_OVERLAY.effectModifier,
    tagWeights: { ...(overlay?.tagWeights ?? DEFAULT_MODE_OVERLAY.tagWeights) },
    timingLock: [...(overlay?.timingLock ?? DEFAULT_MODE_OVERLAY.timingLock)],
    legal: overlay?.legal ?? DEFAULT_MODE_OVERLAY.legal,
    targetingOverride: overlay?.targetingOverride,
    divergencePotential: overlay?.divergencePotential,
  };
}

export function resolveModeOverlay(
  definition: CardDefinition,
  mode: ModeCode,
): ModeOverlay {
  return normalizeModeOverlay(definition.modeOverlay?.[mode]);
}

export function createCardInstance(
  definition: CardDefinition,
  options: {
    readonly instanceId: string;
    readonly mode: ModeCode;
    readonly cost?: number;
    readonly tags?: readonly string[];
    readonly timingClass?: readonly TimingClass[];
    readonly targeting?: Targeting;
    readonly decayTicksRemaining?: number | null;
    readonly divergencePotential?: DivergencePotential;
  },
): CardInstance {
  const overlay = resolveModeOverlay(definition, options.mode);

  return {
    instanceId: options.instanceId,
    definitionId: definition.id,
    card: definition,
    cost: options.cost ?? Number((definition.baseCost * overlay.costModifier).toFixed(3)),
    targeting: options.targeting ?? overlay.targetingOverride ?? definition.targeting,
    timingClass: [...(options.timingClass ?? definition.timingClass)],
    tags: [...new Set([...(definition.tags ?? []), ...(options.tags ?? [])])],
    overlayAppliedForMode: options.mode,
    decayTicksRemaining:
      options.decayTicksRemaining ?? definition.decayTicks ?? null,
    divergencePotential:
      options.divergencePotential ?? overlay.divergencePotential ?? 'LOW',
  };
}

export function mergeEffectPayload(
  base: EffectPayload,
  delta: EffectPayload,
): EffectPayload {
  return {
    cashDelta: (base.cashDelta ?? 0) + (delta.cashDelta ?? 0),
    debtDelta: (base.debtDelta ?? 0) + (delta.debtDelta ?? 0),
    incomeDelta: (base.incomeDelta ?? 0) + (delta.incomeDelta ?? 0),
    expenseDelta: (base.expenseDelta ?? 0) + (delta.expenseDelta ?? 0),
    shieldDelta: (base.shieldDelta ?? 0) + (delta.shieldDelta ?? 0),
    heatDelta: (base.heatDelta ?? 0) + (delta.heatDelta ?? 0),
    trustDelta: (base.trustDelta ?? 0) + (delta.trustDelta ?? 0),
    treasuryDelta: (base.treasuryDelta ?? 0) + (delta.treasuryDelta ?? 0),
    battleBudgetDelta: (base.battleBudgetDelta ?? 0) + (delta.battleBudgetDelta ?? 0),
    holdChargeDelta: (base.holdChargeDelta ?? 0) + (delta.holdChargeDelta ?? 0),
    counterIntelDelta: (base.counterIntelDelta ?? 0) + (delta.counterIntelDelta ?? 0),
    timeDeltaMs: (base.timeDeltaMs ?? 0) + (delta.timeDeltaMs ?? 0),
    divergenceDelta: (base.divergenceDelta ?? 0) + (delta.divergenceDelta ?? 0),
    cascadeTag: delta.cascadeTag ?? base.cascadeTag ?? null,
    injectCards: [...new Set([...(base.injectCards ?? []), ...(delta.injectCards ?? [])])],
    exhaustCards: [...new Set([...(base.exhaustCards ?? []), ...(delta.exhaustCards ?? [])])],
    grantBadges: [...new Set([...(base.grantBadges ?? []), ...(delta.grantBadges ?? [])])],
    namedActionId: delta.namedActionId ?? base.namedActionId ?? null,
  };
}

export function getShieldLayerLabel(layerId: ShieldLayerId): ShieldLayerLabel {
  return SHIELD_LAYER_LABEL_BY_ID[layerId];
}

// ============================================================================
// MARK: Pressure tier analytics — scoring and transition logic
// ============================================================================

/**
 * Compute the normalized pressure risk score for a given tier and score.
 * Used by ML models to assess how close the user is to the next escalation.
 */
export function computePressureRiskScore(tier: PressureTier, score: number): number {
  const tierValue = PRESSURE_TIER_NORMALIZED[tier];
  const escalationThreshold = PRESSURE_TIER_ESCALATION_THRESHOLD[tier];
  const nextTierThreshold = tier === 'T4' ? 100 : PRESSURE_TIER_ESCALATION_THRESHOLD[
    PRESSURE_TIERS[PRESSURE_TIERS.indexOf(tier) + 1] as PressureTier
  ];
  const normalizedInTier = escalationThreshold < nextTierThreshold
    ? Math.max(0, Math.min(1, (score - escalationThreshold) / (nextTierThreshold - escalationThreshold)))
    : 1.0;
  return Math.min(1.0, tierValue + normalizedInTier * 0.25);
}

/**
 * Determine whether escalating from `current` to `next` is valid.
 */
export function canEscalatePressure(
  current: PressureTier,
  next: PressureTier,
  score: number,
  ticksInCurrentTier: number,
): boolean {
  const currentIndex = PRESSURE_TIERS.indexOf(current);
  const nextIndex = PRESSURE_TIERS.indexOf(next);
  if (nextIndex !== currentIndex + 1) return false;
  if (ticksInCurrentTier < PRESSURE_TIER_MIN_HOLD_TICKS[current]) return false;
  return score >= PRESSURE_TIER_ESCALATION_THRESHOLD[next];
}

/**
 * Determine whether de-escalating from `current` to `prev` is valid.
 */
export function canDeescalatePressure(
  current: PressureTier,
  prev: PressureTier,
  score: number,
): boolean {
  const currentIndex = PRESSURE_TIERS.indexOf(current);
  const prevIndex = PRESSURE_TIERS.indexOf(prev);
  if (prevIndex !== currentIndex - 1) return false;
  return score < PRESSURE_TIER_DEESCALATION_THRESHOLD[current];
}

/**
 * Describe the user experience at a given pressure tier.
 */
export function describePressureTierExperience(tier: PressureTier): string {
  const labels: Record<PressureTier, string> = {
    T0: 'You are in control. Build your foundation and execute your strategy.',
    T1: 'Pressure is building. Stay focused — your choices matter more now.',
    T2: 'The walls are closing in. You must play smart and fast.',
    T3: 'Critical pressure. Every tick counts. Do not hesitate.',
    T4: 'Apex pressure. You are at the edge. This is your defining moment.',
  };
  return labels[tier];
}

// ============================================================================
// MARK: Run phase mechanics — phase transitions and progression scoring
// ============================================================================

/**
 * Compute what percentage of the run has elapsed based on current phase and tick.
 */
export function computeRunProgressFraction(
  phase: RunPhase,
  tickInPhase: number,
  phaseTickBudget: number,
): number {
  const phaseOffset = RUN_PHASE_NORMALIZED[phase];
  const phaseFraction = RUN_PHASE_TICK_BUDGET_FRACTION[phase];
  const withinPhase = phaseTickBudget > 0
    ? Math.min(1.0, tickInPhase / phaseTickBudget) * phaseFraction
    : 0;
  return Math.min(1.0, phaseOffset + withinPhase);
}

/**
 * Determine the effective stakes multiplier combining phase and mode.
 */
export function computeEffectiveStakes(phase: RunPhase, mode: ModeCode): number {
  return RUN_PHASE_STAKES_MULTIPLIER[phase] * MODE_DIFFICULTY_MULTIPLIER[mode];
}

/**
 * Check if this is the endgame phase (SOVEREIGNTY).
 */
export function isEndgamePhase(phase: RunPhase): boolean {
  return phase === 'SOVEREIGNTY';
}

/**
 * Check if a run outcome represents the user winning.
 */
export function isWinOutcome(outcome: RunOutcome): boolean {
  return outcome === 'FREEDOM';
}

/**
 * Check if a run outcome represents the user losing.
 */
export function isLossOutcome(outcome: RunOutcome): boolean {
  return outcome !== 'FREEDOM';
}

/**
 * Score how exciting a given outcome is for a given mode (1=low, 5=high).
 */
export function scoreOutcomeExcitement(outcome: RunOutcome, mode: ModeCode): number {
  const baseExcitement: Record<RunOutcome, number> = {
    FREEDOM:   5,
    TIMEOUT:   3,
    BANKRUPT:  4,
    ABANDONED: 1,
  };
  return Math.min(5, baseExcitement[outcome] * MODE_DIFFICULTY_MULTIPLIER[mode]);
}

// ============================================================================
// MARK: Shield layer analytics — defense modeling
// ============================================================================

/**
 * Compute the vulnerability score (0-1) for a shield layer given current / max HP.
 */
export function computeShieldLayerVulnerability(
  layerId: ShieldLayerId,
  currentHp: number,
  maxHp: number,
): number {
  if (maxHp <= 0) return 1.0;
  const integrityRatio = Math.max(0, Math.min(1, currentHp / maxHp));
  const capacityWeight = SHIELD_LAYER_CAPACITY_WEIGHT[layerId];
  return (1.0 - integrityRatio) * capacityWeight;
}

/**
 * Determine which shield layer will absorb an incoming attack first.
 */
export function resolveAttackTargetLayer(
  layers: ReadonlyArray<{ id: ShieldLayerId; current: number }>,
  preferredLayerId: ShieldLayerId | 'DIRECT',
): ShieldLayerId | 'DIRECT' {
  if (preferredLayerId === 'DIRECT') return 'DIRECT';
  for (const priorityId of SHIELD_LAYER_ABSORPTION_ORDER) {
    const layer = layers.find((l) => l.id === priorityId);
    if (layer && layer.current > 0) return priorityId;
  }
  return 'DIRECT';
}

/**
 * Compute overall shield integrity ratio across all layers (0-1).
 */
export function computeShieldIntegrityRatio(
  layers: ReadonlyArray<{ id: ShieldLayerId; current: number; max: number }>,
): number {
  if (layers.length === 0) return 1.0;
  let totalWeighted = 0;
  let totalWeight = 0;
  for (const layer of layers) {
    const weight = SHIELD_LAYER_CAPACITY_WEIGHT[layer.id];
    totalWeight += weight;
    totalWeighted += (layer.max > 0 ? Math.min(1, layer.current / layer.max) : 0) * weight;
  }
  return totalWeight === 0 ? 1.0 : totalWeighted / totalWeight;
}

/**
 * Estimate shield regeneration per tick for a given layer.
 */
export function estimateShieldRegenPerTick(
  layerId: ShieldLayerId,
  maxHp: number,
): number {
  return SHIELD_LAYER_REGEN_RATE[layerId] * maxHp;
}

// ============================================================================
// MARK: Attack event analytics — severity and routing
// ============================================================================

export type AttackSeverityClass = 'CATASTROPHIC' | 'MAJOR' | 'MODERATE' | 'MINOR';

/**
 * Classify an attack's severity based on magnitude and category.
 */
export function classifyAttackSeverity(attack: AttackEvent): AttackSeverityClass {
  const baseScore = attack.magnitude * ATTACK_CATEGORY_BASE_MAGNITUDE[attack.category];
  if (baseScore >= 0.8) return 'CATASTROPHIC';
  if (baseScore >= 0.55) return 'MAJOR';
  if (baseScore >= 0.3) return 'MODERATE';
  return 'MINOR';
}

/**
 * Compute the effective damage from an attack considering category modifiers.
 */
export function computeEffectiveAttackDamage(attack: AttackEvent): number {
  return attack.magnitude * ATTACK_CATEGORY_BASE_MAGNITUDE[attack.category];
}

/**
 * Determine whether an attack can be countered with a COUNTER deck card.
 */
export function isAttackCounterable(attack: AttackEvent): boolean {
  return ATTACK_CATEGORY_IS_COUNTERABLE[attack.category];
}

/**
 * Check whether an attack is targeting the shield layers directly.
 */
export function isShieldTargetedAttack(attack: AttackEvent): boolean {
  return attack.targetLayer !== 'DIRECT';
}

/**
 * Determine if an attack comes from a bot source (vs player opponent).
 */
export function isAttackFromBot(attack: AttackEvent): boolean {
  return isHaterBotId(attack.source);
}

/**
 * Score the urgency of responding to an attack (0-1).
 */
export function scoreAttackResponseUrgency(attack: AttackEvent, currentTick: number): number {
  const ageFactor = Math.max(0, 1.0 - (currentTick - attack.createdAtTick) / 10);
  const magnitudeFactor = computeEffectiveAttackDamage(attack);
  return Math.min(1.0, magnitudeFactor * ageFactor);
}

// ============================================================================
// MARK: Threat envelope modeling — urgency and UX impact
// ============================================================================

export type ThreatUrgencyClass = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NEGLIGIBLE';

/**
 * Score the urgency of a threat envelope (0-1) based on ETA and severity.
 */
export function scoreThreatUrgency(threat: ThreatEnvelope, currentTick: number): number {
  if (threat.etaTicks <= 0) return 1.0;
  const etaUrgency = Math.max(0, 1.0 - threat.etaTicks / 20);
  const visibilityFactor = 1.0 - VISIBILITY_CONCEALMENT_FACTOR[threat.visibleAs];
  return Math.min(1.0, threat.severity * (etaUrgency * 0.6 + visibilityFactor * 0.4));
}

/**
 * Classify a threat by urgency class.
 */
export function classifyThreatUrgency(threat: ThreatEnvelope, currentTick: number): ThreatUrgencyClass {
  const score = scoreThreatUrgency(threat, currentTick);
  if (score >= 0.9) return 'CRITICAL';
  if (score >= 0.7) return 'HIGH';
  if (score >= 0.45) return 'MEDIUM';
  if (score >= 0.2) return 'LOW';
  return 'NEGLIGIBLE';
}

/**
 * Find the highest urgency threat in a list.
 */
export function findMostUrgentThreat(
  threats: readonly ThreatEnvelope[],
  currentTick: number,
): ThreatEnvelope | null {
  if (threats.length === 0) return null;
  return threats.reduce((best, t) =>
    scoreThreatUrgency(t, currentTick) > scoreThreatUrgency(best, currentTick) ? t : best,
  );
}

/**
 * Compute the aggregate threat pressure from all visible threats.
 */
export function computeAggregateThreatPressure(
  threats: readonly ThreatEnvelope[],
  currentTick: number,
): number {
  if (threats.length === 0) return 0;
  const urgencies = threats.map((t) => scoreThreatUrgency(t, currentTick));
  const maxUrgency = Math.max(...urgencies);
  const avgUrgency = urgencies.reduce((a, b) => a + b, 0) / urgencies.length;
  return Math.min(1.0, maxUrgency * 0.6 + avgUrgency * 0.4);
}

// ============================================================================
// MARK: Effect payload analytics — magnitude and risk scoring
// ============================================================================

/**
 * Compute the financial magnitude of an effect payload (positive = good for player).
 */
export function computeEffectFinancialImpact(effect: EffectPayload): number {
  const positive = (effect.cashDelta ?? 0) + (effect.incomeDelta ?? 0) +
    (effect.treasuryDelta ?? 0) - (effect.expenseDelta ?? 0);
  const negative = (effect.debtDelta ?? 0) + (effect.holdChargeDelta ?? 0);
  return positive - negative;
}

/**
 * Compute the shield impact of an effect (positive = healing).
 */
export function computeEffectShieldImpact(effect: EffectPayload): number {
  return effect.shieldDelta ?? 0;
}

/**
 * Compute the overall magnitude of an effect payload (0-infinity, larger = more impactful).
 */
export function computeEffectMagnitude(effect: EffectPayload): number {
  return Math.abs(computeEffectFinancialImpact(effect)) / 1000 +
    Math.abs(computeEffectShieldImpact(effect)) +
    Math.abs(effect.heatDelta ?? 0) * 0.5 +
    Math.abs(effect.trustDelta ?? 0) * 0.3 +
    (effect.injectCards?.length ?? 0) * 0.5 +
    (effect.exhaustCards?.length ?? 0) * 0.4 +
    (effect.timeDeltaMs ?? 0) / 10_000;
}

/**
 * Compute the risk contribution of an effect (higher = more risky for player).
 */
export function computeEffectRiskScore(effect: EffectPayload): number {
  const debtRisk = (effect.debtDelta ?? 0) / 5000;
  const cashLoss = -(effect.cashDelta ?? 0) / 5000;
  const heatRisk = (effect.heatDelta ?? 0);
  const divergenceRisk = (effect.divergenceDelta ?? 0) * 0.5;
  const exhaustRisk = (effect.exhaustCards?.length ?? 0) * 0.15;
  return Math.max(0, debtRisk + cashLoss + heatRisk + divergenceRisk + exhaustRisk);
}

/**
 * Determine if an effect payload is primarily beneficial to the player.
 */
export function isEffectNetPositive(effect: EffectPayload): boolean {
  return computeEffectFinancialImpact(effect) > 0 ||
    computeEffectShieldImpact(effect) > 0 ||
    (effect.injectCards?.length ?? 0) > 0;
}

// ============================================================================
// MARK: Card analytics — cost, power, legality, decay
// ============================================================================

/**
 * Compute the power score of a card instance (0-infinity).
 */
export function computeCardPowerScore(instance: CardInstance): number {
  const rarityWeight = CARD_RARITY_WEIGHT[instance.card.rarity];
  const deckPower = DECK_TYPE_POWER_LEVEL[instance.card.deckType];
  const effectMagnitude = computeEffectMagnitude(instance.card.baseEffect);
  const counterResistance = COUNTERABILITY_RESISTANCE_SCORE[instance.card.counterability];
  const spreadFactor = TARGETING_SPREAD_FACTOR[instance.targeting];
  return rarityWeight * deckPower * (1 + effectMagnitude * 0.5) * counterResistance * spreadFactor;
}

/**
 * Compute cost efficiency — power per unit cost.
 */
export function computeCardCostEfficiency(instance: CardInstance): number {
  if (instance.cost <= 0) return computeCardPowerScore(instance);
  return computeCardPowerScore(instance) / instance.cost;
}

/**
 * Check if a card instance is legal in the given mode.
 */
export function isCardLegalInMode(instance: CardInstance, mode: ModeCode): boolean {
  return instance.card.modeLegal.includes(mode);
}

/**
 * Compute the decay urgency score for a card (0-1).
 * Returns 0 if no decay, approaches 1 as decay ticks run out.
 */
export function computeCardDecayUrgency(instance: CardInstance): number {
  if (instance.decayTicksRemaining === null) return 0;
  if (instance.decayTicksRemaining <= 0) return 1.0;
  return Math.max(0, 1.0 - instance.decayTicksRemaining / 10);
}

/**
 * Check if a card can counter a given attack category.
 */
export function canCardCounterAttack(
  instance: CardInstance,
  attackCategory: AttackCategory,
): boolean {
  return instance.card.deckType === 'COUNTER' &&
    ATTACK_CATEGORY_IS_COUNTERABLE[attackCategory] &&
    instance.card.counterability !== 'NONE';
}

/**
 * Determine the timing window priority for a card (higher = more urgent to play).
 */
export function computeCardTimingPriority(instance: CardInstance): number {
  if (instance.timingClass.length === 0) return TIMING_CLASS_WINDOW_PRIORITY['ANY'];
  return Math.max(...instance.timingClass.map((t) => TIMING_CLASS_WINDOW_PRIORITY[t]));
}

/**
 * Check if a card is offensive (deals damage / pressure vs defensive / healing).
 */
export function isCardOffensive(instance: CardInstance): boolean {
  return DECK_TYPE_IS_OFFENSIVE[instance.card.deckType];
}

// ============================================================================
// MARK: Cascade chain analytics — progression, health, recovery scoring
// ============================================================================

export type CascadeHealthClass = 'THRIVING' | 'STABLE' | 'AT_RISK' | 'CRITICAL' | 'LOST';

/**
 * Compute the health score of a cascade chain (0-1).
 */
export function scoreCascadeChainHealth(chain: CascadeChainInstance): number {
  if (chain.status === 'COMPLETED') return 1.0;
  if (chain.status === 'BROKEN') return 0.0;
  const linksFired = chain.links.filter((l) => l.scheduledTick > 0).length;
  const progress = chain.links.length > 0 ? linksFired / chain.links.length : 0;
  const positiveBonus = chain.positive ? 0.2 : 0;
  return Math.min(1.0, progress * 0.7 + positiveBonus + 0.1);
}

/**
 * Classify a cascade chain's health.
 */
export function classifyCascadeChainHealth(chain: CascadeChainInstance): CascadeHealthClass {
  if (chain.status === 'COMPLETED') return 'THRIVING';
  if (chain.status === 'BROKEN') return 'LOST';
  const score = scoreCascadeChainHealth(chain);
  if (score >= 0.75) return 'STABLE';
  if (score >= 0.45) return 'AT_RISK';
  return 'CRITICAL';
}

/**
 * Compute the progress percentage of a cascade chain (0-100).
 */
export function computeCascadeProgressPercent(chain: CascadeChainInstance): number {
  if (chain.status === 'COMPLETED') return 100;
  if (chain.status === 'BROKEN') return 0;
  if (chain.links.length === 0) return 0;
  const fired = chain.links.filter((l) => l.scheduledTick > 0).length;
  return Math.round((fired / chain.links.length) * 100);
}

/**
 * Determine if a broken cascade chain is recoverable (has recovery tags).
 */
export function isCascadeRecoverable(chain: CascadeChainInstance): boolean {
  return chain.status === 'BROKEN' && chain.recoveryTags.length > 0;
}

/**
 * Compute the net experience impact of a cascade chain on the user.
 * Positive chain = positive impact; negative chain = negative impact.
 */
export function computeCascadeExperienceImpact(chain: CascadeChainInstance): number {
  const health = scoreCascadeChainHealth(chain);
  const linkMagnitude = chain.links.reduce(
    (acc, link) => acc + computeEffectMagnitude(link.effect),
    0,
  );
  const normalizedMagnitude = Math.min(1.0, linkMagnitude / (chain.links.length * 2 + 1));
  return chain.positive
    ? health * normalizedMagnitude
    : -(1 - health) * normalizedMagnitude;
}

// ============================================================================
// MARK: Legend marker analytics — scoring and narrative value
// ============================================================================

export type LegendMarkerSignificance = 'HISTORIC' | 'MEMORABLE' | 'NOTABLE' | 'MINOR';

/**
 * Numeric weight for each legend marker kind.
 */
export const LEGEND_MARKER_KIND_WEIGHT: Record<LegendMarker['kind'], number> = {
  GOLD:   1.0,
  PURPLE: 0.85,
  RED:    0.7,
  SILVER: 0.5,
  BLACK:  0.3,
};

/**
 * Compute the narrative experience value of a legend marker.
 */
export function computeLegendMarkerValue(marker: LegendMarker): number {
  return LEGEND_MARKER_KIND_WEIGHT[marker.kind];
}

/**
 * Classify the significance of a legend marker.
 */
export function classifyLegendMarkerSignificance(marker: LegendMarker): LegendMarkerSignificance {
  const weight = LEGEND_MARKER_KIND_WEIGHT[marker.kind];
  if (weight >= 0.9) return 'HISTORIC';
  if (weight >= 0.65) return 'MEMORABLE';
  if (weight >= 0.4) return 'NOTABLE';
  return 'MINOR';
}

/**
 * Compute the density of legend markers (markers per tick).
 */
export function computeLegendMarkerDensity(
  markers: readonly LegendMarker[],
  totalTicks: number,
): number {
  if (totalTicks <= 0) return 0;
  return Math.min(1.0, markers.length / Math.max(1, totalTicks / 10));
}

/**
 * Find the most significant legend marker in a list.
 */
export function findMostSignificantMarker(
  markers: readonly LegendMarker[],
): LegendMarker | null {
  if (markers.length === 0) return null;
  return markers.reduce((best, m) =>
    computeLegendMarkerValue(m) > computeLegendMarkerValue(best) ? m : best,
  );
}

// ============================================================================
// MARK: Bot behavior model — threat scoring and state transitions
// ============================================================================

/**
 * Compute the threat score for a bot in a given state.
 */
export function computeBotThreatScore(botId: HaterBotId, state: BotState): number {
  return BOT_THREAT_LEVEL[botId] * BOT_STATE_THREAT_MULTIPLIER[state];
}

/**
 * Determine if a bot state transition is valid.
 */
export function isBotStateTransitionValid(from: BotState, to: BotState): boolean {
  return BOT_STATE_ALLOWED_TRANSITIONS[from].includes(to);
}

/**
 * Compute the aggregate bot threat score across multiple bots.
 */
export function computeAggregateBotThreat(
  bots: ReadonlyArray<{ id: HaterBotId; state: BotState }>,
): number {
  if (bots.length === 0) return 0;
  const scores = bots.map((b) => computeBotThreatScore(b.id, b.state));
  const maxScore = Math.max(...scores);
  const sumScore = scores.reduce((a, b) => a + b, 0);
  return Math.min(1.0, maxScore * 0.7 + (sumScore / HATER_BOT_IDS.length) * 0.3);
}

/**
 * Predict what states a bot is likely to transition to next.
 */
export function predictBotNextStates(current: BotState): BotState[] {
  return [...BOT_STATE_ALLOWED_TRANSITIONS[current]];
}

/**
 * Determine the overall defense urgency from the active bot fleet.
 */
export function computeDefenseUrgency(
  bots: ReadonlyArray<{ id: HaterBotId; state: BotState }>,
): number {
  return computeAggregateBotThreat(bots);
}

// ============================================================================
// MARK: Mode overlay effectiveness analytics
// ============================================================================

/**
 * Compute how much a mode overlay restricts the player's options.
 */
export function computeOverlayRestrictionScore(overlay: ModeOverlay): number {
  const lockFraction = overlay.timingLock.length / TIMING_CLASSES.length;
  const costBurden = Math.max(0, overlay.costModifier - 1.0);
  const effectReduction = Math.max(0, 1.0 - overlay.effectModifier);
  const illegalPenalty = overlay.legal ? 0 : 1.0;
  return Math.min(1.0, lockFraction * 0.35 + costBurden * 0.25 + effectReduction * 0.25 + illegalPenalty * 0.15);
}

/**
 * Compute the effective power boost or reduction of a mode overlay.
 */
export function computeOverlayPowerFactor(overlay: ModeOverlay): number {
  return overlay.effectModifier * (1.0 / Math.max(0.01, overlay.costModifier));
}

/**
 * Determine if a mode overlay is net-beneficial for the player.
 */
export function isOverlayNetBeneficial(overlay: ModeOverlay): boolean {
  return computeOverlayPowerFactor(overlay) > 1.0 && overlay.legal;
}

// ============================================================================
// MARK: EngineEventMap payload builders — type-safe event construction
// ============================================================================

export class EngineEventPayloadBuilder {
  static buildRunStarted(
    runId: string,
    mode: ModeCode,
    seed: string,
  ): EngineEventMap['run.started'] {
    return { runId, mode, seed };
  }

  static buildTickStarted(
    runId: string,
    tick: number,
    phase: RunPhase,
  ): EngineEventMap['tick.started'] {
    return { runId, tick, phase };
  }

  static buildTickCompleted(
    runId: string,
    tick: number,
    phase: RunPhase,
    checksum: string,
  ): EngineEventMap['tick.completed'] {
    return { runId, tick, phase, checksum };
  }

  static buildPressureChanged(
    from: PressureTier,
    to: PressureTier,
    score: number,
  ): EngineEventMap['pressure.changed'] {
    return { from, to, score };
  }

  static buildTensionUpdated(
    score: number,
    visibleThreats: number,
  ): EngineEventMap['tension.updated'] {
    return { score, visibleThreats };
  }

  static buildThreatRouted(
    threatId: string,
    source: string,
    category: AttackCategory,
    targetLayer: ShieldLayerId | 'DIRECT',
    targetEntity: AttackTargetEntity,
  ): EngineEventMap['threat.routed'] {
    return { threatId, source, category, targetLayer, targetEntity };
  }

  static buildBattleAttackInjected(
    attack: AttackEvent,
  ): EngineEventMap['battle.attack.injected'] {
    return { attack };
  }

  static buildBattleBotStateChanged(
    botId: HaterBotId,
    from: BotState,
    to: BotState,
    tick: number,
  ): EngineEventMap['battle.bot.state_changed'] {
    return { botId, from, to, tick };
  }

  static buildShieldBreached(
    attackId: string,
    layerId: ShieldLayerId,
    tick: number,
    cascadesTriggered: number,
  ): EngineEventMap['shield.breached'] {
    return { attackId, layerId, tick, cascadesTriggered };
  }

  static buildCascadeChainCreated(
    chainId: string,
    templateId: string,
    positive: boolean,
  ): EngineEventMap['cascade.chain.created'] {
    return { chainId, templateId, positive };
  }

  static buildCascadeChainProgressed(
    chainId: string,
    linkId: string,
    tick: number,
  ): EngineEventMap['cascade.chain.progressed'] {
    return { chainId, linkId, tick };
  }

  static buildCardPlayed(
    runId: string,
    actorId: string,
    cardId: string,
    tick: number,
    mode: ModeCode,
  ): EngineEventMap['card.played'] {
    return { runId, actorId, cardId, tick, mode };
  }

  static buildModeDefectionProgressed(
    playerId: string,
    step: number,
    cardId: string,
  ): EngineEventMap['mode.defection.progressed'] {
    return { playerId, step, cardId };
  }

  static buildModePhaseWindowOpened(
    mode: ModeCode,
    tick: number,
    timing: TimingClass,
    remaining: number,
  ): EngineEventMap['mode.phase_window.opened'] {
    return { mode, tick, timing, remaining };
  }

  static buildDecisionWindowOpened(
    windowId: string,
    tick: number,
    durationMs: number,
    actorId?: string,
  ): EngineEventMap['decision.window.opened'] {
    return { windowId, tick, durationMs, actorId };
  }

  static buildDecisionWindowClosed(
    windowId: string,
    tick: number,
    accepted: boolean,
    actorId?: string,
  ): EngineEventMap['decision.window.closed'] {
    return { windowId, tick, accepted, actorId };
  }

  static buildIntegrityQuarantined(
    runId: string,
    tick: number,
    reasons: string[],
  ): EngineEventMap['integrity.quarantined'] {
    return { runId, tick, reasons };
  }

  static buildProofSealed(
    runId: string,
    proofHash: string,
    integrityStatus: IntegrityStatus,
    grade: VerifiedGrade | string,
    outcome: RunOutcome,
  ): EngineEventMap['proof.sealed'] {
    return { runId, proofHash, integrityStatus, grade, outcome };
  }

  static buildSovereigntyCompleted(
    runId: string,
    score: number,
    grade: string,
    proofHash: string,
    outcome: RunOutcome,
  ): EngineEventMap['sovereignty.completed'] {
    return { runId, score, grade, proofHash, outcome };
  }
}

// ============================================================================
// MARK: GamePrimitives ML feature vectors — 16-feature extraction surface
// ============================================================================

export const GAME_PRIMITIVES_ML_FEATURE_LABELS: readonly string[] = [
  'pressure_tier_normalized',    // 0: how high is the pressure
  'run_phase_normalized',         // 1: how far into the run
  'mode_normalized',              // 2: which mode
  'shield_vulnerability_max',     // 3: most vulnerable layer
  'attack_severity_max',          // 4: worst active attack
  'cascade_health_avg',           // 5: average cascade health
  'threat_urgency_max',           // 6: most urgent threat
  'card_power_max',               // 7: best available card power
  'effect_magnitude_total',       // 8: total effect in play
  'bot_threat_max',               // 9: most dangerous bot
  'timing_class_priority_max',    // 10: highest timing priority
  'deck_power_avg',               // 11: average deck power
  'visibility_exposure_max',      // 12: most exposed threat
  'integrity_risk_max',           // 13: highest integrity risk
  'legend_marker_density',        // 14: how legend-rich this run is
  'divergence_potential_max',     // 15: highest divergence risk
] as const;

export interface GamePrimitivesMLVector {
  readonly tick: number;
  readonly features: readonly number[];
  readonly featureLabels: readonly string[];
  readonly pressureTier: PressureTier;
  readonly phase: RunPhase;
  readonly mode: ModeCode;
}

export interface GamePrimitivesMLContext {
  readonly tick: number;
  readonly vector: GamePrimitivesMLVector;
  readonly pressureRisk: number;
  readonly shieldVulnerability: number;
  readonly overallThreatScore: number;
  readonly cascadeHealthScore: number;
  readonly botThreatScore: number;
  readonly cardHandStrength: number;
  readonly runExperienceScore: number;
  readonly isHighStakes: boolean;
  readonly isEndgame: boolean;
}

export interface GamePrimitivesMLInput {
  readonly tick: number;
  readonly pressureTier: PressureTier;
  readonly pressureScore: number;
  readonly phase: RunPhase;
  readonly mode: ModeCode;
  readonly shieldLayers: ReadonlyArray<{ id: ShieldLayerId; current: number; max: number }>;
  readonly activeAttacks: readonly AttackEvent[];
  readonly activeChains: readonly CascadeChainInstance[];
  readonly visibleThreats: readonly ThreatEnvelope[];
  readonly handCards: readonly CardInstance[];
  readonly activeBots: ReadonlyArray<{ id: HaterBotId; state: BotState }>;
  readonly legendMarkers: readonly LegendMarker[];
  readonly integrityStatus: IntegrityStatus;
  readonly totalTicks: number;
}

export class GamePrimitivesMLVectorBuilder {
  static build(input: GamePrimitivesMLInput): GamePrimitivesMLVector {
    const pressureTierNorm = PRESSURE_TIER_NORMALIZED[input.pressureTier];
    const phasNorm = RUN_PHASE_NORMALIZED[input.phase];
    const modeNorm = MODE_NORMALIZED[input.mode];

    const shieldVulnMax = input.shieldLayers.length === 0 ? 0 :
      Math.max(...input.shieldLayers.map((l) => computeShieldLayerVulnerability(l.id, l.current, l.max)));

    const attackSeverityMax = input.activeAttacks.length === 0 ? 0 :
      Math.max(...input.activeAttacks.map((a) => computeEffectiveAttackDamage(a)));

    const cascadeHealthAvg = input.activeChains.length === 0 ? 1 :
      input.activeChains.reduce((s, c) => s + scoreCascadeChainHealth(c), 0) / input.activeChains.length;

    const threatUrgencyMax = input.visibleThreats.length === 0 ? 0 :
      Math.max(...input.visibleThreats.map((t) => scoreThreatUrgency(t, input.tick)));

    const cardPowerMax = input.handCards.length === 0 ? 0 :
      Math.min(1.0, Math.max(...input.handCards.map((c) => computeCardPowerScore(c))) / 5);

    const effectMagnitudeTotal = input.handCards.length === 0 ? 0 :
      Math.min(1.0, input.handCards.reduce((s, c) => s + computeEffectMagnitude(c.card.baseEffect), 0) / 10);

    const botThreatMax = input.activeBots.length === 0 ? 0 :
      Math.max(...input.activeBots.map((b) => computeBotThreatScore(b.id, b.state)));

    const timingPriorityMax = input.handCards.length === 0 ? 0 :
      Math.min(1.0, Math.max(...input.handCards.map((c) => computeCardTimingPriority(c))) / 100);

    const deckPowerAvg = input.handCards.length === 0 ? 0.5 :
      input.handCards.reduce((s, c) => s + DECK_TYPE_POWER_LEVEL[c.card.deckType], 0) / input.handCards.length;

    const visibilityExposureMax = input.visibleThreats.length === 0 ? 0 :
      Math.max(...input.visibleThreats.map((t) => 1.0 - VISIBILITY_CONCEALMENT_FACTOR[t.visibleAs]));

    const integrityRisk = INTEGRITY_STATUS_RISK_SCORE[input.integrityStatus];

    const legendDensity = computeLegendMarkerDensity(input.legendMarkers, input.totalTicks);

    const divergenceMax = input.handCards.length === 0 ? 0 :
      Math.max(...input.handCards.map((c) => DIVERGENCE_POTENTIAL_NORMALIZED[c.divergencePotential]));

    return {
      tick: input.tick,
      features: [
        pressureTierNorm,
        phasNorm,
        modeNorm,
        shieldVulnMax,
        Math.min(1.0, attackSeverityMax),
        cascadeHealthAvg,
        threatUrgencyMax,
        cardPowerMax,
        effectMagnitudeTotal,
        botThreatMax,
        timingPriorityMax,
        deckPowerAvg,
        visibilityExposureMax,
        integrityRisk,
        legendDensity,
        divergenceMax,
      ],
      featureLabels: GAME_PRIMITIVES_ML_FEATURE_LABELS,
      pressureTier: input.pressureTier,
      phase: input.phase,
      mode: input.mode,
    };
  }

  static zero(tick: number, tier: PressureTier, phase: RunPhase, mode: ModeCode): GamePrimitivesMLVector {
    return {
      tick,
      features: new Array(GAME_PRIMITIVES_ML_FEATURE_LABELS.length).fill(0),
      featureLabels: GAME_PRIMITIVES_ML_FEATURE_LABELS,
      pressureTier: tier,
      phase,
      mode,
    };
  }

  static buildContext(input: GamePrimitivesMLInput): GamePrimitivesMLContext {
    const vector = GamePrimitivesMLVectorBuilder.build(input);
    const pressureRisk = computePressureRiskScore(input.pressureTier, input.pressureScore);
    const shieldVulnerability = vector.features[3] ?? 0;
    const overallThreatScore = computeAggregateThreatPressure(input.visibleThreats, input.tick);
    const cascadeHealthScore = vector.features[5] ?? 1;
    const botThreatScore = computeAggregateBotThreat(input.activeBots);
    const cardHandStrength = vector.features[7] ?? 0;
    const stakes = computeEffectiveStakes(input.phase, input.mode);
    const runExperienceScore = Math.min(1.0,
      (1.0 - pressureRisk) * 0.3 +
      cascadeHealthScore * 0.25 +
      (1.0 - overallThreatScore) * 0.25 +
      cardHandStrength * 0.2,
    ) * stakes;
    return {
      tick: input.tick,
      vector,
      pressureRisk,
      shieldVulnerability,
      overallThreatScore,
      cascadeHealthScore,
      botThreatScore,
      cardHandStrength,
      runExperienceScore,
      isHighStakes: stakes >= 0.85,
      isEndgame: isEndgamePhase(input.phase),
    };
  }
}

// ============================================================================
// MARK: GamePrimitivesAnalytics — static analytics surface
// ============================================================================

export class GamePrimitivesAnalytics {
  /**
   * Compute a composite run risk score (0-1) from multiple factors.
   */
  static computeRunRiskScore(
    pressureTier: PressureTier,
    shieldIntegrity: number,
    botThreat: number,
    threatPressure: number,
  ): number {
    const tierRisk = PRESSURE_TIER_NORMALIZED[pressureTier];
    const shieldRisk = 1.0 - Math.max(0, Math.min(1, shieldIntegrity));
    return Math.min(1.0,
      tierRisk * 0.35 +
      shieldRisk * 0.25 +
      botThreat * 0.2 +
      threatPressure * 0.2,
    );
  }

  /**
   * Compute the momentum score for a run — positive = accelerating toward FREEDOM.
   */
  static computeRunMomentum(
    activePositiveCascades: number,
    activeNegativeCascades: number,
    pressureTrend: 'RISING' | 'STABLE' | 'FALLING',
    recentCardPlays: number,
  ): number {
    const cascadeBonus = (activePositiveCascades - activeNegativeCascades) / Math.max(1, activePositiveCascades + activeNegativeCascades);
    const pressureBonus = pressureTrend === 'FALLING' ? 0.3 : pressureTrend === 'STABLE' ? 0 : -0.3;
    const playBonus = Math.min(0.3, recentCardPlays * 0.1);
    return Math.min(1.0, Math.max(-1.0, cascadeBonus + pressureBonus + playBonus));
  }

  /**
   * Estimate the probability of winning from the current game state.
   */
  static estimateWinProbability(
    runRisk: number,
    momentum: number,
    phase: RunPhase,
    econProgress: number,
  ): number {
    const phaseBonus = phase === 'SOVEREIGNTY' ? 0.15 : phase === 'ESCALATION' ? 0.05 : 0;
    const base = Math.max(0, 0.5 - runRisk * 0.4 + momentum * 0.2 + econProgress * 0.15 + phaseBonus);
    return Math.min(1.0, Math.max(0, base));
  }

  /**
   * Compute a card recommendation score for a set of hand cards given game state.
   */
  static rankCardsForCurrentState(
    hand: readonly CardInstance[],
    pressureTier: PressureTier,
    shieldIntegrity: number,
    activeAttacks: readonly AttackEvent[],
  ): ReadonlyArray<{ card: CardInstance; score: number; reason: string }> {
    return hand.map((card) => {
      let score = computeCardPowerScore(card) * 0.5;
      let reason = 'base power';

      // Urgency boost if pressure is high
      if (PRESSURE_TIER_NORMALIZED[pressureTier] >= 0.75) {
        score += 0.2;
        reason = 'high pressure bonus';
      }

      // Shield healing priority if shields are low
      if (shieldIntegrity < 0.4 && (card.card.baseEffect.shieldDelta ?? 0) > 0) {
        score += 0.3;
        reason = 'shield critical healing priority';
      }

      // Counter bonus for counterable attacks
      const counterableAttack = activeAttacks.find((a) => isAttackCounterable(a));
      if (counterableAttack && canCardCounterAttack(card, counterableAttack.category)) {
        score += 0.4;
        reason = `counter opportunity: ${counterableAttack.category}`;
      }

      // Decay urgency
      const decayUrgency = computeCardDecayUrgency(card);
      if (decayUrgency > 0.7) {
        score += decayUrgency * 0.25;
        reason = 'decay urgency';
      }

      return { card, score: Math.min(1.0, score), reason };
    }).sort((a, b) => b.score - a.score);
  }

  /**
   * Identify all critical game state threats across multiple domains.
   */
  static identifyCriticalThreats(
    pressureTier: PressureTier,
    shieldIntegrity: number,
    botThreat: number,
    cascadeChains: readonly CascadeChainInstance[],
    integrityStatus: IntegrityStatus,
  ): ReadonlyArray<{ domain: string; severity: number; description: string }> {
    const threats: Array<{ domain: string; severity: number; description: string }> = [];

    if (PRESSURE_TIER_NORMALIZED[pressureTier] >= 0.75) {
      threats.push({
        domain: 'PRESSURE',
        severity: PRESSURE_TIER_NORMALIZED[pressureTier],
        description: describePressureTierExperience(pressureTier),
      });
    }

    if (shieldIntegrity < 0.3) {
      threats.push({
        domain: 'SHIELD',
        severity: 1.0 - shieldIntegrity,
        description: `Shield integrity critical at ${Math.round(shieldIntegrity * 100)}%.`,
      });
    }

    if (botThreat >= 0.7) {
      threats.push({
        domain: 'BOT_FLEET',
        severity: botThreat,
        description: `Hater bot fleet operating at ${Math.round(botThreat * 100)}% threat capacity.`,
      });
    }

    const brokenChains = cascadeChains.filter((c) => c.status === 'BROKEN');
    if (brokenChains.length > 0) {
      threats.push({
        domain: 'CASCADE',
        severity: Math.min(1.0, brokenChains.length / 3),
        description: `${brokenChains.length} cascade chain(s) broken — check recovery opportunities.`,
      });
    }

    if (INTEGRITY_STATUS_RISK_SCORE[integrityStatus] >= 0.7) {
      threats.push({
        domain: 'INTEGRITY',
        severity: INTEGRITY_STATUS_RISK_SCORE[integrityStatus],
        description: `Run integrity is ${integrityStatus}. Proof chain at risk.`,
      });
    }

    return threats.sort((a, b) => b.severity - a.severity);
  }

  /**
   * Compute how much the user experience (UX) score has changed between two ticks.
   */
  static computeUXDelta(prev: GamePrimitivesMLContext, curr: GamePrimitivesMLContext): number {
    return curr.runExperienceScore - prev.runExperienceScore;
  }

  /**
   * Determine if a run is in a "cinematic moment" (high stakes + high engagement).
   */
  static isCinematicMoment(
    runRisk: number,
    momentum: number,
    recentLegendMarkers: number,
  ): boolean {
    return runRisk >= 0.65 && Math.abs(momentum) >= 0.4 && recentLegendMarkers >= 1;
  }
}

// ============================================================================
// MARK: GamePrimitivesValidator — deep validation of all domain interfaces
// ============================================================================

export interface GamePrimitivesValidationError {
  readonly field: string;
  readonly code: string;
  readonly message: string;
}

export class GamePrimitivesValidator {
  static validateEffectPayload(effect: EffectPayload): GamePrimitivesValidationError[] {
    const errors: GamePrimitivesValidationError[] = [];
    if (effect.cashDelta !== undefined && !Number.isFinite(effect.cashDelta)) {
      errors.push({ field: 'cashDelta', code: 'NOT_FINITE', message: 'cashDelta must be finite.' });
    }
    if (effect.debtDelta !== undefined && effect.debtDelta < 0) {
      errors.push({ field: 'debtDelta', code: 'NEGATIVE_DEBT', message: 'debtDelta cannot be negative.' });
    }
    if (effect.shieldDelta !== undefined && !Number.isFinite(effect.shieldDelta)) {
      errors.push({ field: 'shieldDelta', code: 'NOT_FINITE', message: 'shieldDelta must be finite.' });
    }
    if (effect.timeDeltaMs !== undefined && effect.timeDeltaMs < -600_000) {
      errors.push({ field: 'timeDeltaMs', code: 'TOO_NEGATIVE', message: 'timeDeltaMs cannot reduce time by more than 10 minutes.' });
    }
    return errors;
  }

  static validateCardDefinition(def: CardDefinition): GamePrimitivesValidationError[] {
    const errors: GamePrimitivesValidationError[] = [];
    if (!def.id || def.id.trim().length === 0) {
      errors.push({ field: 'id', code: 'EMPTY_ID', message: 'CardDefinition id cannot be empty.' });
    }
    if (!isDeckType(def.deckType)) {
      errors.push({ field: 'deckType', code: 'INVALID_DECK_TYPE', message: `Unknown deckType: ${def.deckType}` });
    }
    if (def.baseCost < 0) {
      errors.push({ field: 'baseCost', code: 'NEGATIVE_COST', message: 'baseCost cannot be negative.' });
    }
    for (const tc of def.timingClass) {
      if (!isTimingClass(tc)) {
        errors.push({ field: 'timingClass', code: 'INVALID_TIMING_CLASS', message: `Unknown timingClass: ${tc}` });
      }
    }
    for (const mode of def.modeLegal) {
      if (!isModeCode(mode)) {
        errors.push({ field: 'modeLegal', code: 'INVALID_MODE', message: `Unknown mode: ${mode}` });
      }
    }
    errors.push(...GamePrimitivesValidator.validateEffectPayload(def.baseEffect).map((e) => ({
      ...e,
      field: `baseEffect.${e.field}`,
    })));
    return errors;
  }

  static validateCardInstance(instance: CardInstance): GamePrimitivesValidationError[] {
    const errors: GamePrimitivesValidationError[] = [];
    if (!instance.instanceId || instance.instanceId.trim().length === 0) {
      errors.push({ field: 'instanceId', code: 'EMPTY_ID', message: 'instanceId cannot be empty.' });
    }
    if (!isModeCode(instance.overlayAppliedForMode)) {
      errors.push({ field: 'overlayAppliedForMode', code: 'INVALID_MODE', message: `Invalid mode: ${instance.overlayAppliedForMode}` });
    }
    if (instance.cost < 0) {
      errors.push({ field: 'cost', code: 'NEGATIVE_COST', message: 'Card instance cost cannot be negative.' });
    }
    if (instance.decayTicksRemaining !== null && instance.decayTicksRemaining < 0) {
      errors.push({ field: 'decayTicksRemaining', code: 'NEGATIVE_DECAY', message: 'decayTicksRemaining cannot be negative.' });
    }
    errors.push(...GamePrimitivesValidator.validateCardDefinition(instance.card).map((e) => ({
      ...e,
      field: `card.${e.field}`,
    })));
    return errors;
  }

  static validateAttackEvent(attack: AttackEvent): GamePrimitivesValidationError[] {
    const errors: GamePrimitivesValidationError[] = [];
    if (!attack.attackId || attack.attackId.trim().length === 0) {
      errors.push({ field: 'attackId', code: 'EMPTY_ID', message: 'attackId cannot be empty.' });
    }
    if (attack.magnitude < 0 || attack.magnitude > 1) {
      errors.push({ field: 'magnitude', code: 'OUT_OF_RANGE', message: 'magnitude must be in [0, 1].' });
    }
    if (attack.createdAtTick < 0) {
      errors.push({ field: 'createdAtTick', code: 'NEGATIVE_TICK', message: 'createdAtTick cannot be negative.' });
    }
    if (attack.targetLayer !== 'DIRECT' && !isShieldLayerId(attack.targetLayer)) {
      errors.push({ field: 'targetLayer', code: 'INVALID_LAYER', message: `Invalid targetLayer: ${attack.targetLayer}` });
    }
    return errors;
  }

  static validateThreatEnvelope(threat: ThreatEnvelope): GamePrimitivesValidationError[] {
    const errors: GamePrimitivesValidationError[] = [];
    if (!threat.threatId || threat.threatId.trim().length === 0) {
      errors.push({ field: 'threatId', code: 'EMPTY_ID', message: 'threatId cannot be empty.' });
    }
    if (threat.severity < 0 || threat.severity > 1) {
      errors.push({ field: 'severity', code: 'OUT_OF_RANGE', message: 'severity must be in [0, 1].' });
    }
    if (threat.etaTicks < 0) {
      errors.push({ field: 'etaTicks', code: 'NEGATIVE_ETA', message: 'etaTicks cannot be negative.' });
    }
    if (!isVisibilityLevel(threat.visibleAs)) {
      errors.push({ field: 'visibleAs', code: 'INVALID_VISIBILITY', message: `Invalid visibilityLevel: ${threat.visibleAs}` });
    }
    return errors;
  }

  static validateCascadeChainInstance(chain: CascadeChainInstance): GamePrimitivesValidationError[] {
    const errors: GamePrimitivesValidationError[] = [];
    if (!chain.chainId || chain.chainId.trim().length === 0) {
      errors.push({ field: 'chainId', code: 'EMPTY_ID', message: 'chainId cannot be empty.' });
    }
    if (chain.createdAtTick < 0) {
      errors.push({ field: 'createdAtTick', code: 'NEGATIVE_TICK', message: 'createdAtTick cannot be negative.' });
    }
    if (!['ACTIVE', 'BROKEN', 'COMPLETED'].includes(chain.status)) {
      errors.push({ field: 'status', code: 'INVALID_STATUS', message: `Invalid cascade status: ${chain.status}` });
    }
    for (const link of chain.links) {
      if (!link.linkId) {
        errors.push({ field: 'links.linkId', code: 'EMPTY_ID', message: 'CascadeLink linkId cannot be empty.' });
      }
    }
    return errors;
  }

  static validateLegendMarker(marker: LegendMarker): GamePrimitivesValidationError[] {
    const errors: GamePrimitivesValidationError[] = [];
    if (!marker.markerId || marker.markerId.trim().length === 0) {
      errors.push({ field: 'markerId', code: 'EMPTY_ID', message: 'markerId cannot be empty.' });
    }
    if (marker.tick < 0) {
      errors.push({ field: 'tick', code: 'NEGATIVE_TICK', message: 'tick cannot be negative.' });
    }
    if (!['GOLD', 'RED', 'PURPLE', 'SILVER', 'BLACK'].includes(marker.kind)) {
      errors.push({ field: 'kind', code: 'INVALID_KIND', message: `Invalid marker kind: ${marker.kind}` });
    }
    return errors;
  }

  static validateAll(input: {
    cards?: CardDefinition[];
    instances?: CardInstance[];
    attacks?: AttackEvent[];
    threats?: ThreatEnvelope[];
    chains?: CascadeChainInstance[];
    markers?: LegendMarker[];
  }): GamePrimitivesValidationError[] {
    return [
      ...(input.cards ?? []).flatMap(GamePrimitivesValidator.validateCardDefinition),
      ...(input.instances ?? []).flatMap(GamePrimitivesValidator.validateCardInstance),
      ...(input.attacks ?? []).flatMap(GamePrimitivesValidator.validateAttackEvent),
      ...(input.threats ?? []).flatMap(GamePrimitivesValidator.validateThreatEnvelope),
      ...(input.chains ?? []).flatMap(GamePrimitivesValidator.validateCascadeChainInstance),
      ...(input.markers ?? []).flatMap(GamePrimitivesValidator.validateLegendMarker),
    ];
  }
}

// ============================================================================
// MARK: RunExperienceScorer — holistic run experience quality assessment
// ============================================================================

export interface RunExperienceReport {
  readonly tick: number;
  readonly overallScore: number;            // 0-1
  readonly tensionScore: number;             // 0-1
  readonly agencyScore: number;              // 0-1 (user feels in control)
  readonly narrativeScore: number;           // 0-1 (legendary moments, drama)
  readonly recoveryScore: number;            // 0-1 (can user come back)
  readonly progressScore: number;            // 0-1 (moving toward FREEDOM)
  readonly isHighStakes: boolean;
  readonly isCinematic: boolean;
  readonly dominantDomain: string;
  readonly primaryRecommendation: string;
}

export class RunExperienceScorer {
  /**
   * Compute a full run experience report from current game state.
   */
  static computeReport(
    tick: number,
    pressureTier: PressureTier,
    phase: RunPhase,
    mode: ModeCode,
    shieldIntegrity: number,
    botThreat: number,
    cascadeChains: readonly CascadeChainInstance[],
    legendMarkers: readonly LegendMarker[],
    econProgress: number,
    activeAttacks: readonly AttackEvent[],
    hand: readonly CardInstance[],
    totalTicks: number,
  ): RunExperienceReport {
    const tierNorm = PRESSURE_TIER_NORMALIZED[pressureTier];
    const stakes = computeEffectiveStakes(phase, mode);

    // Tension: high pressure + active attacks = high tension (good for engagement)
    const attackPresence = Math.min(1.0, activeAttacks.length / 3);
    const tensionScore = Math.min(1.0, tierNorm * 0.6 + attackPresence * 0.4) * stakes;

    // Agency: player has good cards, shields are up, no overwhelming attacks
    const handStrength = hand.length === 0 ? 0 :
      Math.min(1.0, hand.reduce((s, c) => s + computeCardPowerScore(c), 0) / (hand.length * 3));
    const agencyScore = Math.min(1.0,
      handStrength * 0.4 +
      shieldIntegrity * 0.35 +
      (1.0 - botThreat) * 0.25,
    );

    // Narrative: legend markers + cascade health
    const markerDensity = computeLegendMarkerDensity(legendMarkers, totalTicks);
    const positiveCascades = cascadeChains.filter((c) => c.positive && c.status === 'ACTIVE').length;
    const narrativeScore = Math.min(1.0, markerDensity * 0.5 + (positiveCascades / Math.max(1, cascadeChains.length)) * 0.5);

    // Recovery: can the user bounce back from their current state?
    const recoverableChains = cascadeChains.filter(isCascadeRecoverable).length;
    const recoveryScore = Math.min(1.0,
      shieldIntegrity * 0.3 +
      handStrength * 0.3 +
      (recoverableChains / Math.max(1, cascadeChains.length)) * 0.2 +
      econProgress * 0.2,
    );

    // Progress: how close is the user to FREEDOM?
    const progressScore = Math.min(1.0, econProgress * 0.5 + RUN_PHASE_NORMALIZED[phase] * 0.3 + (1.0 - tierNorm) * 0.2);

    const overallScore = (tensionScore * 0.2 + agencyScore * 0.3 + narrativeScore * 0.2 + recoveryScore * 0.15 + progressScore * 0.15);

    const isHighStakes = stakes >= 0.85;
    const isCinematic = tensionScore >= 0.65 && (narrativeScore >= 0.5 || Math.abs(agencyScore - tensionScore) >= 0.3);

    // Find dominant domain
    const domains = [
      { name: 'TENSION', score: tensionScore },
      { name: 'AGENCY', score: agencyScore },
      { name: 'NARRATIVE', score: narrativeScore },
      { name: 'RECOVERY', score: recoveryScore },
      { name: 'PROGRESS', score: progressScore },
    ];
    const dominant = domains.reduce((a, b) => (b.score > a.score ? b : a));

    // Primary recommendation
    let primaryRecommendation = 'Continue executing your strategy.';
    if (agencyScore < 0.3) {
      primaryRecommendation = 'Your options are limited. Find a counter play or rebuild shields.';
    } else if (tensionScore >= 0.85) {
      primaryRecommendation = 'Critical tension. Play your best card immediately.';
    } else if (progressScore < 0.2) {
      primaryRecommendation = 'Focus on financial progress toward your freedom target.';
    } else if (narrativeScore >= 0.75) {
      primaryRecommendation = 'You are writing legend moments. Sustain the momentum.';
    }

    return {
      tick,
      overallScore,
      tensionScore,
      agencyScore,
      narrativeScore,
      recoveryScore,
      progressScore,
      isHighStakes,
      isCinematic,
      dominantDomain: dominant.name,
      primaryRecommendation,
    };
  }
}

// ============================================================================
// MARK: PressureExperienceModel — what each pressure tier feels like to user
// ============================================================================

export interface PressureExperienceProfile {
  readonly tier: PressureTier;
  readonly urgencyLabel: string;
  readonly riskLevel: number;
  readonly recommendedAction: string;
  readonly narrativeHint: string;
  readonly chatSignalPriority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | 'CRITICAL';
}

export class PressureExperienceModel {
  private static readonly PROFILES: Record<PressureTier, PressureExperienceProfile> = {
    T0: {
      tier: 'T0',
      urgencyLabel: PRESSURE_TIER_URGENCY_LABEL['T0'],
      riskLevel: PRESSURE_TIER_NORMALIZED['T0'],
      recommendedAction: 'Build income streams and fortify shields.',
      narrativeHint: 'The calm before the storm. Use this window wisely.',
      chatSignalPriority: 'LOW',
    },
    T1: {
      tier: 'T1',
      urgencyLabel: PRESSURE_TIER_URGENCY_LABEL['T1'],
      riskLevel: PRESSURE_TIER_NORMALIZED['T1'],
      recommendedAction: 'Monitor bot activity. Have counter cards ready.',
      narrativeHint: 'The system is watching you. Make your next move count.',
      chatSignalPriority: 'MEDIUM',
    },
    T2: {
      tier: 'T2',
      urgencyLabel: PRESSURE_TIER_URGENCY_LABEL['T2'],
      riskLevel: PRESSURE_TIER_NORMALIZED['T2'],
      recommendedAction: 'Activate defenses. Play high-impact cards this tick.',
      narrativeHint: 'The heat is real. Speed is your friend now.',
      chatSignalPriority: 'HIGH',
    },
    T3: {
      tier: 'T3',
      urgencyLabel: PRESSURE_TIER_URGENCY_LABEL['T3'],
      riskLevel: PRESSURE_TIER_NORMALIZED['T3'],
      recommendedAction: 'Emergency protocols. Play counters and rescue cards immediately.',
      narrativeHint: 'You are fighting for your run. No hesitation.',
      chatSignalPriority: 'URGENT',
    },
    T4: {
      tier: 'T4',
      urgencyLabel: PRESSURE_TIER_URGENCY_LABEL['T4'],
      riskLevel: PRESSURE_TIER_NORMALIZED['T4'],
      recommendedAction: 'Survival mode. Play everything you have. Every tick matters.',
      narrativeHint: 'This is the apex. Your entire run comes down to this moment.',
      chatSignalPriority: 'CRITICAL',
    },
  };

  static getProfile(tier: PressureTier): PressureExperienceProfile {
    return PressureExperienceModel.PROFILES[tier];
  }

  static getAllProfiles(): ReadonlyArray<PressureExperienceProfile> {
    return PRESSURE_TIERS.map((t) => PressureExperienceModel.PROFILES[t]);
  }

  static escalationMessage(from: PressureTier, to: PressureTier): string {
    const fromIdx = PRESSURE_TIERS.indexOf(from);
    const toIdx = PRESSURE_TIERS.indexOf(to);
    if (toIdx > fromIdx) {
      return `Pressure escalating: ${from} → ${to}. ${PressureExperienceModel.PROFILES[to].narrativeHint}`;
    }
    return `Pressure easing: ${from} → ${to}. ${PressureExperienceModel.PROFILES[to].recommendedAction}`;
  }
}

// ============================================================================
// MARK: CombatExperienceModel — what being attacked feels like to the user
// ============================================================================

export interface CombatExperienceSignal {
  readonly attackId: string;
  readonly severityClass: AttackSeverityClass;
  readonly urgencyScore: number;
  readonly isCounterable: boolean;
  readonly narrativeMessage: string;
  readonly recommendedResponse: string;
  readonly chatPriority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export class CombatExperienceModel {
  static buildSignal(attack: AttackEvent, currentTick: number): CombatExperienceSignal {
    const severityClass = classifyAttackSeverity(attack);
    const urgencyScore = scoreAttackResponseUrgency(attack, currentTick);
    const counterable = isAttackCounterable(attack);

    const messages: Record<AttackSeverityClass, string> = {
      CATASTROPHIC: 'A catastrophic attack is incoming. This could end your run.',
      MAJOR: 'A major attack threatens your position. Respond immediately.',
      MODERATE: 'A meaningful attack is in play. Consider your response.',
      MINOR: 'Minor harassment detected. Monitor and continue.',
    };

    const responses: Record<AttackSeverityClass, string> = {
      CATASTROPHIC: counterable
        ? 'Play a COUNTER or RESCUE card NOW.'
        : 'Fortify remaining shields. Every point of defense matters.',
      MAJOR: counterable
        ? 'A counter is available. Use it strategically.'
        : 'Absorb the hit and rebuild. Preserve your best cards.',
      MODERATE: 'Optional counter. Play if you have the window.',
      MINOR: 'No immediate action required.',
    };

    const priorities: Record<AttackSeverityClass, CombatExperienceSignal['chatPriority']> = {
      CATASTROPHIC: 'CRITICAL',
      MAJOR: 'HIGH',
      MODERATE: 'MEDIUM',
      MINOR: 'LOW',
    };

    return {
      attackId: attack.attackId,
      severityClass,
      urgencyScore,
      isCounterable: counterable,
      narrativeMessage: messages[severityClass],
      recommendedResponse: responses[severityClass],
      chatPriority: priorities[severityClass],
    };
  }

  static buildBatchSignals(attacks: readonly AttackEvent[], currentTick: number): CombatExperienceSignal[] {
    return attacks
      .map((a) => CombatExperienceModel.buildSignal(a, currentTick))
      .sort((a, b) => b.urgencyScore - a.urgencyScore);
  }

  static isUnderHeavyFire(attacks: readonly AttackEvent[], currentTick: number): boolean {
    const highUrgency = attacks.filter((a) => scoreAttackResponseUrgency(a, currentTick) >= 0.7);
    return highUrgency.length >= 2;
  }
}

// ============================================================================
// MARK: CardPlayExperienceModel — what it feels like to play a card
// ============================================================================

export interface CardPlayExperienceOutcome {
  readonly cardId: string;
  readonly powerScore: number;
  readonly impactClass: 'TRANSFORMATIVE' | 'SIGNIFICANT' | 'NOTABLE' | 'ROUTINE';
  readonly hasPositiveFinancialImpact: boolean;
  readonly hasShieldHealing: boolean;
  readonly willTriggerCascade: boolean;
  readonly narrativeWeight: 'LEGENDARY' | 'HIGH' | 'MEDIUM' | 'LOW';
  readonly chatMessage: string;
}

export class CardPlayExperienceModel {
  static evaluatePlay(
    instance: CardInstance,
    overlay: ModeOverlay,
    currentPressureTier: PressureTier,
  ): CardPlayExperienceOutcome {
    const powerScore = computeCardPowerScore(instance);
    const effectMagnitude = computeEffectMagnitude(instance.card.baseEffect);
    const rarityWeight = CARD_RARITY_WEIGHT[instance.card.rarity];
    const stakeMultiplier = 1 + PRESSURE_TIER_NORMALIZED[currentPressureTier];
    const overlayFactor = computeOverlayPowerFactor(overlay);
    const adjustedPower = powerScore * stakeMultiplier * overlayFactor;

    let impactClass: CardPlayExperienceOutcome['impactClass'];
    if (adjustedPower >= 3.5) impactClass = 'TRANSFORMATIVE';
    else if (adjustedPower >= 2.0) impactClass = 'SIGNIFICANT';
    else if (adjustedPower >= 1.0) impactClass = 'NOTABLE';
    else impactClass = 'ROUTINE';

    let narrativeWeight: CardPlayExperienceOutcome['narrativeWeight'];
    if (rarityWeight >= 4.0 && stakeMultiplier >= 1.5) narrativeWeight = 'LEGENDARY';
    else if (rarityWeight >= 2.25) narrativeWeight = 'HIGH';
    else if (rarityWeight >= 1.5) narrativeWeight = 'MEDIUM';
    else narrativeWeight = 'LOW';

    const chatMessages: Record<CardPlayExperienceOutcome['impactClass'], string> = {
      TRANSFORMATIVE: `${instance.card.name} played — a game-changing move. The entire board shifts.`,
      SIGNIFICANT: `${instance.card.name} played — strong impact on your position.`,
      NOTABLE: `${instance.card.name} played — a meaningful contribution to your run.`,
      ROUTINE: `${instance.card.name} played.`,
    };

    return {
      cardId: instance.instanceId,
      powerScore: Math.min(1.0, adjustedPower / 5),
      impactClass,
      hasPositiveFinancialImpact: isEffectNetPositive(instance.card.baseEffect),
      hasShieldHealing: (instance.card.baseEffect.shieldDelta ?? 0) > 0,
      willTriggerCascade: instance.card.baseEffect.cascadeTag !== null &&
        instance.card.baseEffect.cascadeTag !== undefined,
      narrativeWeight,
      chatMessage: chatMessages[impactClass],
    };
  }

  static scoreHandReadiness(
    hand: readonly CardInstance[],
    mode: ModeCode,
    pressureTier: PressureTier,
  ): number {
    if (hand.length === 0) return 0;
    const legalCards = hand.filter((c) => isCardLegalInMode(c, mode));
    const totalPower = legalCards.reduce((s, c) => s + computeCardPowerScore(c), 0);
    const urgencyMultiplier = 1 + PRESSURE_TIER_NORMALIZED[pressureTier] * 0.5;
    return Math.min(1.0, (totalPower / Math.max(1, legalCards.length)) * urgencyMultiplier / 5);
  }
}

// ============================================================================
// MARK: GamePrimitivesChatBridge — output contract for chat adapter consumption
// ============================================================================

export interface GamePrimitivesChatSignal {
  readonly signalId: string;
  readonly domain: 'GAME_PRIMITIVES';
  readonly kind:
    | 'PRESSURE_CHANGE'
    | 'ATTACK_INCOMING'
    | 'SHIELD_VULNERABLE'
    | 'CASCADE_HEALTH'
    | 'CARD_PLAY_IMPACT'
    | 'THREAT_URGENT'
    | 'BOT_ESCALATION'
    | 'LEGEND_MOMENT'
    | 'PHASE_TRANSITION'
    | 'INTEGRITY_RISK'
    | 'RUN_EXPERIENCE';
  readonly tick: number;
  readonly urgencyScore: number;          // 0-1
  readonly narrativeWeight: number;       // 0-1
  readonly message: string;
  readonly details: Readonly<Record<string, unknown>>;
  readonly recommendedAction: string;
}

export class GamePrimitivesChatBridge {
  private static nextId = 0;

  private static newId(): string {
    return `gp-signal-${++GamePrimitivesChatBridge.nextId}-${Date.now()}`;
  }

  static fromPressureChange(
    from: PressureTier,
    to: PressureTier,
    tick: number,
  ): GamePrimitivesChatSignal {
    const profile = PressureExperienceModel.getProfile(to);
    const urgency = PRESSURE_TIER_NORMALIZED[to];
    return {
      signalId: GamePrimitivesChatBridge.newId(),
      domain: 'GAME_PRIMITIVES',
      kind: 'PRESSURE_CHANGE',
      tick,
      urgencyScore: urgency,
      narrativeWeight: urgency * 0.8,
      message: PressureExperienceModel.escalationMessage(from, to),
      details: { from, to, urgencyLabel: profile.urgencyLabel },
      recommendedAction: profile.recommendedAction,
    };
  }

  static fromAttackEvent(
    attack: AttackEvent,
    currentTick: number,
  ): GamePrimitivesChatSignal {
    const signal = CombatExperienceModel.buildSignal(attack, currentTick);
    return {
      signalId: GamePrimitivesChatBridge.newId(),
      domain: 'GAME_PRIMITIVES',
      kind: 'ATTACK_INCOMING',
      tick: currentTick,
      urgencyScore: signal.urgencyScore,
      narrativeWeight: signal.severityClass === 'CATASTROPHIC' ? 1.0 : signal.urgencyScore * 0.8,
      message: signal.narrativeMessage,
      details: {
        attackId: attack.attackId,
        category: attack.category,
        magnitude: attack.magnitude,
        severityClass: signal.severityClass,
      },
      recommendedAction: signal.recommendedResponse,
    };
  }

  static fromCascadeHealth(
    chain: CascadeChainInstance,
    tick: number,
  ): GamePrimitivesChatSignal {
    const health = scoreCascadeChainHealth(chain);
    const healthClass = classifyCascadeChainHealth(chain);
    const urgency = chain.positive ? 1.0 - health : health;
    return {
      signalId: GamePrimitivesChatBridge.newId(),
      domain: 'GAME_PRIMITIVES',
      kind: 'CASCADE_HEALTH',
      tick,
      urgencyScore: urgency,
      narrativeWeight: Math.min(1.0, (chain.links.length / 5) * urgency),
      message: chain.positive
        ? `Positive cascade chain '${chain.chainId}' at ${healthClass} health.`
        : `Negative cascade chain '${chain.chainId}' at ${healthClass} health.`,
      details: {
        chainId: chain.chainId,
        positive: chain.positive,
        status: chain.status,
        healthClass,
        progress: computeCascadeProgressPercent(chain),
      },
      recommendedAction: isCascadeRecoverable(chain)
        ? 'Recovery tags available. Play a RESCUE card to restore the chain.'
        : chain.positive ? 'Protect this cascade chain.' : 'Break this negative chain quickly.',
    };
  }

  static fromRunExperience(
    report: RunExperienceReport,
    tick: number,
  ): GamePrimitivesChatSignal {
    return {
      signalId: GamePrimitivesChatBridge.newId(),
      domain: 'GAME_PRIMITIVES',
      kind: 'RUN_EXPERIENCE',
      tick,
      urgencyScore: report.isHighStakes ? 0.8 : 0.3,
      narrativeWeight: report.isCinematic ? 1.0 : report.narrativeScore,
      message: report.isCinematic
        ? `Cinematic moment at tick ${tick}. ${report.primaryRecommendation}`
        : report.primaryRecommendation,
      details: {
        overallScore: report.overallScore,
        tensionScore: report.tensionScore,
        agencyScore: report.agencyScore,
        dominantDomain: report.dominantDomain,
        isHighStakes: report.isHighStakes,
        isCinematic: report.isCinematic,
      },
      recommendedAction: report.primaryRecommendation,
    };
  }

  static fromLegendMarker(
    marker: LegendMarker,
    tick: number,
  ): GamePrimitivesChatSignal {
    const value = computeLegendMarkerValue(marker);
    const significance = classifyLegendMarkerSignificance(marker);
    return {
      signalId: GamePrimitivesChatBridge.newId(),
      domain: 'GAME_PRIMITIVES',
      kind: 'LEGEND_MOMENT',
      tick,
      urgencyScore: 0.2,
      narrativeWeight: value,
      message: `${significance} moment recorded: ${marker.summary}`,
      details: {
        markerId: marker.markerId,
        kind: marker.kind,
        significance,
        cardId: marker.cardId,
      },
      recommendedAction: significance === 'HISTORIC'
        ? 'This is a defining moment in your run. Document it well.'
        : 'Keep building your legend.',
    };
  }
}
