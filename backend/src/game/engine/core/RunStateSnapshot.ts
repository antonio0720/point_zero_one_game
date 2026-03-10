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

import type {
  AttackEvent,
  CascadeChainInstance,
  HaterBotId,
  IntegrityStatus,
  LegendMarker,
  ModeCode,
  PressureTier,
  RunOutcome,
  RunPhase,
  ShieldLayerId,
  ShieldLayerLabel,
  ThreatEnvelope,
  CardInstance,
  BotState,
} from './GamePrimitives';

export interface ShieldLayerState {
  layerId: ShieldLayerId;
  label: ShieldLayerLabel;
  current: number;
  max: number;
  regenPerTick: number;
}

export interface EconomyState {
  cash: number;
  debt: number;
  incomePerTick: number;
  expensesPerTick: number;
  netWorth: number;
  freedomTarget: number;
  haterHeat: number;
  opportunitiesPurchased: number;
  privilegePlays: number;
}

export interface PressureState {
  score: number;
  tier: PressureTier;
  previousTier: PressureTier;
  upwardCrossings: number;
  survivedHighPressureTicks: number;
}

export interface TensionState {
  score: number;
  anticipation: number;
  visibleThreats: ThreatEnvelope[];
  maxPulseTriggered: boolean;
}

export interface ShieldState {
  layers: ShieldLayerState[];
  weakestLayerId: ShieldLayerId;
  blockedThisRun: number;
  damagedThisRun: number;
  breachesThisRun: number;
  repairQueueDepth: number;
}

export interface BotRuntimeState {
  botId: HaterBotId;
  label: string;
  state: BotState;
  heat: number;
  lastAttackTick: number | null;
  attacksLanded: number;
  attacksBlocked: number;
  neutralized: boolean;
}

export interface BattleState {
  bots: BotRuntimeState[];
  battleBudget: number;
  battleBudgetCap: number;
  extractionCooldownTicks: number;
  firstBloodClaimed: boolean;
  pendingAttacks: AttackEvent[];
  sharedOpportunityDeckCursor: number;
  rivalryHeatCarry: number;
}

export interface CascadeState {
  activeChains: CascadeChainInstance[];
  positiveTrackers: string[];
  brokenChains: number;
  completedChains: number;
  repeatedTriggerCounts: Record<string, number>;
}

export interface SovereigntyState {
  integrityStatus: IntegrityStatus;
  tickChecksums: string[];
  proofHash: string | null;
  sovereigntyScore: number;
  verifiedGrade: string | null;
  proofBadges: string[];
  gapVsLegend: number;
  gapClosingRate: number;
}

export interface CardsState {
  hand: CardInstance[];
  discard: string[];
  exhaust: string[];
  drawHistory: string[];
  lastPlayed: string[];
  ghostMarkers: LegendMarker[];
}

export interface ModeState {
  holdEnabled: boolean;
  loadoutEnabled: boolean;
  sharedTreasury: boolean;
  sharedTreasuryBalance: number;
  trustScores: Record<string, number>;
  roleAssignments: Record<string, string>;
  defectionStepByPlayer: Record<string, number>;
  legendMarkersEnabled: boolean;
  communityHeatModifier: number;
  sharedOpportunityDeck: boolean;
  counterIntelTier: number;
  spectatorLimit: number;
  phaseBoundaryWindowsRemaining: number;
  bleedMode: boolean;
  handicapIds: string[];
  advantageId: string | null;
  disabledBots: HaterBotId[];
}

export interface TimerState {
  seasonBudgetMs: number;
  extensionBudgetMs: number;
  elapsedMs: number;
  currentTickDurationMs: number;
  holdCharges: number;
  activeDecisionWindows: Record<string, number>;
  frozenWindowIds: string[];
}

export interface DecisionRecord {
  tick: number;
  actorId: string;
  cardId: string;
  latencyMs: number;
  timingClass: string[];
  accepted: boolean;
}

export interface TelemetryState {
  decisions: DecisionRecord[];
  outcomeReason: string | null;
  lastTickChecksum: string | null;
  forkHints: string[];
}

export interface RunStateSnapshot {
  runId: string;
  userId: string;
  seed: string;
  mode: ModeCode;
  tick: number;
  phase: RunPhase;
  outcome: RunOutcome | null;
  tags: string[];
  economy: EconomyState;
  pressure: PressureState;
  tension: TensionState;
  shield: ShieldState;
  battle: BattleState;
  cascade: CascadeState;
  sovereignty: SovereigntyState;
  cards: CardsState;
  modeState: ModeState;
  timers: TimerState;
  telemetry: TelemetryState;
}
