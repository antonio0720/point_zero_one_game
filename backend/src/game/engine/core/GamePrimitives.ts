/*
 * POINT ZERO ONE — BACKEND ENGINE CORE
 * /backend/src/game/engine/core/GamePrimitives.ts
 *
 * Doctrine:
 * - this file is the canonical shared primitive surface for backend simulation
 * - types here must be mode-aware, engine-safe, and serialization-friendly
 * - additive extensibility is preferred over breaking renames
 * - cards, attacks, threats, overlays, and proof events remain backend-owned
 */

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

export const MODE_CODES = ['solo', 'pvp', 'coop', 'ghost'] as const;
export const PRESSURE_TIERS = ['T0', 'T1', 'T2', 'T3', 'T4'] as const;
export const RUN_PHASES = ['FOUNDATION', 'ESCALATION', 'SOVEREIGNTY'] as const;
export const RUN_OUTCOMES = ['FREEDOM', 'TIMEOUT', 'BANKRUPT', 'ABANDONED'] as const;
export const SHIELD_LAYER_IDS = ['L1', 'L2', 'L3', 'L4'] as const;
export const HATER_BOT_IDS = ['BOT_01', 'BOT_02', 'BOT_03', 'BOT_04', 'BOT_05'] as const;
export const TIMING_CLASSES = [
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
] as const;
export const DECK_TYPES = [
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

export const DEFAULT_MODE_OVERLAY: Readonly<ModeOverlay> = Object.freeze({
  costModifier: 1,
  effectModifier: 1,
  tagWeights: Object.freeze({}),
  timingLock: Object.freeze([]),
  legal: true,
});

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