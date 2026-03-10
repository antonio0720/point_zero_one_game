/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND MODE CONTRACTS
 * pzo-web/src/game/modes/contracts.ts
 * ----------------------------------------------------------------------------
 * Frontend-only mode contracts that project engine state into mode-native UI
 * surfaces. These contracts intentionally mirror doctrine from the game-mode
 * and card bibles while remaining decoupled from backend persistence.
 * ============================================================================
 */

export type FrontendRunMode = 'solo' | 'asymmetric-pvp' | 'co-op' | 'ghost';
export type FrontendModeCode = 'empire' | 'predator' | 'syndicate' | 'phantom';
export type ModeOutcome = 'FREEDOM' | 'TIMEOUT' | 'BANKRUPT' | 'ABANDONED';
export type PressureTier = 'T0' | 'T1' | 'T2' | 'T3' | 'T4';
export type SoloPhase = 'FOUNDATION' | 'ESCALATION' | 'SOVEREIGNTY';
export type PsycheState = 'COMPOSED' | 'STRESSED' | 'CRACKING' | 'BREAKING' | 'DESPERATE';
export type TrustBand = 'BROKEN' | 'FRACTURED' | 'WORKING' | 'STRONG' | 'SOVEREIGN_TRUST';
export type DivergencePotential = 'LOW' | 'MEDIUM' | 'HIGH';
export type GapDirection = 'UP' | 'DOWN' | 'FLAT';
export type LegendMarkerType = 'GOLD' | 'RED' | 'PURPLE' | 'SILVER' | 'BLACK';
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
export type Counterability = 'NONE' | 'SOFT' | 'HARD';
export type Targeting = 'SELF' | 'OPPONENT' | 'TEAMMATE' | 'TEAM' | 'GLOBAL';

export interface EffectPayload {
  cashDelta?: number;
  incomeDelta?: number;
  shieldDelta?: number;
  heatDelta?: number;
  cascadeLink?: string | null;
  cardInject?: string | null;
  battleBudgetDelta?: number;
  trustDelta?: number;
  divergenceDelta?: number;
}

export interface ModeOverlay {
  cost_modifier: number;
  effect_modifier: number;
  tag_weights: Record<string, number>;
  timing_lock: TimingClass[];
  legal: boolean;
  targeting_override: Targeting;
}

export interface BaseCardLike {
  id: string;
  name: string;
  deck_type: DeckType;
  base_cost: number;
  base_effect: EffectPayload;
  tags: string[];
  timing_class: TimingClass;
  rarity: 'COMMON' | 'UNCOMMON' | 'RARE' | 'LEGENDARY';
  auto_resolve?: boolean;
  counterability?: Counterability;
  targeting?: Targeting;
  decision_timer_override?: number | null;
  decay?: number | null;
  mode_legal?: FrontendRunMode[];
  mode_overlay?: Partial<Record<FrontendRunMode, Partial<ModeOverlay>>> | null;
  educational_tag?: string;
  divergence_potential?: DivergencePotential;
}

export interface RuntimeModeCard extends BaseCardLike {
  runtime_cost: number;
  runtime_effect: EffectPayload;
  runtime_timing: TimingClass[];
  runtime_targeting: Targeting;
  runtime_tag_weights: Record<string, number>;
  legal_in_mode: boolean;
}

export interface MetricBar {
  id: string;
  label: string;
  current: number;
  max: number;
  pct: number;
  colorToken: string;
  subtitle?: string;
}

export interface EventFeedItem {
  id: string;
  tick: number;
  title: string;
  body: string;
  severity: 'info' | 'warn' | 'danger' | 'success';
  lane: 'system' | 'cards' | 'combat' | 'team' | 'ghost';
}

export interface CORDProjection {
  projectedCord: number;
  projectedGrade: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
  outcome: ModeOutcome;
  componentBreakdown: Record<string, number>;
  appliedBonuses: string[];
  ceiling: number;
}

export interface EngineSnapshotLike {
  runId: string;
  seed: string | number;
  tick: number;
  elapsedMs: number;
  totalRunMs: number;
  cash: number;
  netWorth: number;
  incomePerTick: number;
  expensePerTick: number;
  freedomThreshold: number;
  pressureTier: PressureTier;
  pressureValue?: number;
  shields: Record<'L1' | 'L2' | 'L3' | 'L4', number>;
  haterHeats?: Record<string, number>;
  blockedSabotages?: number;
  cascadeChainsBroken?: number;
  decisionSpeedScore?: number;
  pressureSurvivedScore?: number;
  battleBudget?: number;
  opponent?: {
    cash: number;
    netWorth: number;
    shields: Record<'L1' | 'L2' | 'L3' | 'L4', number>;
    battleBudget?: number;
    decisionSpeedScore?: number;
    cascadeChainsActive?: number;
  };
  team?: {
    treasury: number;
    trustScores: Record<string, number>;
    players: TeamPlayerState[];
    criticalAlerts?: number;
  };
  ghost?: {
    legendCord: number;
    legendAgeHours: number;
    challengersBeaten?: number;
    challengeCount?: number;
    beatRate?: number;
    averageClosingGap?: number;
    markers: LegendMarker[];
  };
}

export interface LegendMarker {
  id: string;
  tick: number;
  type: LegendMarkerType;
  note: string;
}

export interface TeamPlayerState {
  playerId: string;
  displayName: string;
  role: TeamRole;
  trustScore: number;
  personalPressureTier: PressureTier;
  freedom: boolean;
  defected?: boolean;
  contribution?: number;
}

export type TeamRole =
  | 'INCOME_BUILDER'
  | 'SHIELD_ARCHITECT'
  | 'DEBT_SURGEON'
  | 'INTEL_BROKER';

export interface HoldState {
  baseHolds: number;
  bonusHolds: number;
  usedHolds: number;
  holdAllowed: boolean;
  noHoldBonusEligible: boolean;
}

export interface SoloProjection {
  phase: SoloPhase;
  isolationTaxActive: boolean;
  isolationTaxRate: number;
  bleedMode: boolean;
  comebackSurgeActive: boolean;
  comebackTicks: number;
  pressureJournalEntry: string;
  holdState: HoldState;
}

export interface PredatorProjection {
  battleBudget: number;
  battleBudgetCap: number;
  psycheState: PsycheState;
  firstBloodAvailable: boolean;
  counterWindowOpen: boolean;
  visibleThreatQueue: string[];
  spectatorProjection: {
    liveViewers: number;
    predictionBiasPct: number;
    cordLead: number;
  };
}

export interface SyndicateProjection {
  treasury: number;
  treasuryCritical: boolean;
  trustBand: TrustBand;
  synergyActive: boolean;
  warAlert: boolean;
  defectionRisk: number;
  roles: TeamPlayerState[];
  proofShareReady: boolean;
}

export interface PhantomProjection {
  gapDirection: GapDirection;
  gapValue: number;
  legendDecayTier: string;
  markerWindowOpen: boolean;
  currentMarker: LegendMarker | null;
  proofBadges: string[];
  historicalDifficultyRating: number;
}

export interface FrontendModeState {
  runMode: FrontendRunMode;
  modeCode: FrontendModeCode;
  uiLabel: string;
  screenName: string;
  tick: number;
  elapsedMs: number;
  totalRunMs: number;
  pressureTier: PressureTier;
  shieldBars: MetricBar[];
  primaryBars: MetricBar[];
  eventFeed: EventFeedItem[];
  cord: CORDProjection;
  runtimeCards: RuntimeModeCard[];
  solo?: SoloProjection;
  predator?: PredatorProjection;
  syndicate?: SyndicateProjection;
  phantom?: PhantomProjection;
}

export interface FrontendModeAdapter {
  readonly runMode: FrontendRunMode;
  readonly modeCode: FrontendModeCode;
  readonly uiLabel: string;
  readonly screenName: string;
  bootstrap(snapshot: EngineSnapshotLike, cards?: BaseCardLike[]): FrontendModeState;
  reduce(prev: FrontendModeState, snapshot: EngineSnapshotLike, cards?: BaseCardLike[]): FrontendModeState;
}
