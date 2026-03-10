/*
 * POINT ZERO ONE — BACKEND ENGINE 15X GENERATOR
 * Generated at: 2026-03-10T01:00:08.825776+00:00
 *
 * Doctrine:
 * - backend becomes the authoritative simulation surface
 * - seven engines remain distinct
 * - mode-native rules are enforced at runtime
 * - cards are backend-validated, not UI-trusted
 * - proof / integrity / CORD remain backend-owned
 */

export type ModeCode = 'solo' | 'pvp' | 'coop' | 'ghost';
export type PressureTier = 'T0' | 'T1' | 'T2' | 'T3' | 'T4';
export type RunPhase = 'FOUNDATION' | 'ESCALATION' | 'SOVEREIGNTY';
export type RunOutcome = 'FREEDOM' | 'TIMEOUT' | 'BANKRUPT' | 'ABANDONED';
export type ShieldLayerId = 'L1' | 'L2' | 'L3' | 'L4';
export type ShieldLayerLabel = 'CASH_RESERVE' | 'CREDIT_LINE' | 'INCOME_BASE' | 'NETWORK_CORE';
export type HaterBotId = 'BOT_01' | 'BOT_02' | 'BOT_03' | 'BOT_04' | 'BOT_05';
export type BotState = 'DORMANT' | 'WATCHING' | 'TARGETING' | 'ATTACKING' | 'RETREATING' | 'NEUTRALIZED';
export type Targeting = 'SELF' | 'OPPONENT' | 'TEAMMATE' | 'TEAM' | 'GLOBAL';
export type Counterability = 'NONE' | 'SOFT' | 'HARD';
export type TimingClass = 'PRE' | 'POST' | 'FATE' | 'CTR' | 'RES' | 'AID' | 'GBM' | 'CAS' | 'PHZ' | 'PSK' | 'END' | 'ANY';
export type DeckType = 'OPPORTUNITY' | 'IPA' | 'FUBAR' | 'MISSED_OPPORTUNITY' | 'PRIVILEGED' | 'SO' | 'SABOTAGE' | 'COUNTER' | 'AID' | 'RESCUE' | 'DISCIPLINE' | 'TRUST' | 'BLUFF' | 'GHOST';
export type VisibilityLevel = 'HIDDEN' | 'SILHOUETTE' | 'PARTIAL' | 'EXPOSED';
export type DivergencePotential = 'LOW' | 'MEDIUM' | 'HIGH';
export type IntegrityStatus = 'PENDING' | 'VERIFIED' | 'QUARANTINED' | 'UNVERIFIED';
export type AttackCategory = 'EXTRACTION' | 'LOCK' | 'DRAIN' | 'HEAT' | 'BREACH' | 'DEBT';

export interface EffectPayload {
  cashDelta?: number;
  incomeDelta?: number;
  shieldDelta?: number;
  heatDelta?: number;
  trustDelta?: number;
  timeDeltaMs?: number;
  divergenceDelta?: number;
  cascadeTag?: string | null;
  injectCards?: string[];
}

export interface ModeOverlay {
  costModifier: number;
  effectModifier: number;
  tagWeights: Record<string, number>;
  timingLock: TimingClass[];
  legal: boolean;
  targetingOverride?: Targeting;
  divergencePotential?: DivergencePotential;
}

export interface CardDefinition {
  id: string;
  name: string;
  deckType: DeckType;
  baseCost: number;
  baseEffect: EffectPayload;
  tags: string[];
  timingClass: TimingClass[];
  rarity: 'COMMON' | 'UNCOMMON' | 'RARE' | 'LEGENDARY';
  autoResolve: boolean;
  counterability: Counterability;
  targeting: Targeting;
  decisionTimerOverrideMs: number | null;
  decayTicks: number | null;
  modeLegal: ModeCode[];
  modeOverlay?: Partial<Record<ModeCode, Partial<ModeOverlay>>>;
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
  targetEntity: 'SELF' | 'OPPONENT' | 'TEAM' | 'PLAYER';
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
  'run.started': { runId: string; mode: ModeCode; seed: string };
  'tick.started': { runId: string; tick: number; phase: RunPhase };
  'tick.completed': { runId: string; tick: number; phase: RunPhase; checksum: string };
  'pressure.changed': { from: PressureTier; to: PressureTier; score: number };
  'tension.updated': { score: number; visibleThreats: number };
  'battle.attack.injected': { attack: AttackEvent };
  'shield.breached': { attackId: string; layerId: ShieldLayerId; tick: number; cascadesTriggered: number };
  'cascade.chain.created': { chainId: string; templateId: string; positive: boolean };
  'cascade.chain.progressed': { chainId: string; linkId: string; tick: number };
  'card.played': { runId: string; actorId: string; cardId: string; tick: number; mode: ModeCode };
  'mode.defection.progressed': { playerId: string; step: number; cardId: string };
  'sovereignty.completed': { runId: string; score: number; grade: string; proofHash: string; outcome: RunOutcome };
}
