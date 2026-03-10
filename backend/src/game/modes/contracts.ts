/*
 * POINT ZERO ONE — BACKEND MODES 15X GENERATOR
 * Generated at: 2026-03-10T01:26:02.003447+00:00
 *
 * Doctrine:
 * - backend owns mode truth, not the client
 * - four battlegrounds are materially different at runtime
 * - card legality, timing, targeting, and scoring are mode-native
 * - cross-player economies are server-owned
 * - CORD bonuses, proof conditions, and ghost logic are authoritative
 */

import type {
  CardDefinition,
  CardInstance,
  DeckType,
  HaterBotId,
  LegendMarker,
  ModeCode,
  PressureTier,
  Targeting,
  ThreatEnvelope,
  TimingClass,
} from '../engine/core/GamePrimitives';
import type { RunStateSnapshot } from '../engine/core/RunStateSnapshot';

export type TeamRoleId =
  | 'INCOME_BUILDER'
  | 'SHIELD_ARCHITECT'
  | 'OPPORTUNITY_HUNTER'
  | 'COUNTER_INTEL';

export type AdvantageId =
  | 'MOMENTUM_CAPITAL'
  | 'NETWORK_ACTIVATED'
  | 'FORECLOSURE_BLOCK'
  | 'INTEL_PASS'
  | 'PHANTOM_SEED'
  | 'DEBT_SHIELD';

export type HandicapId =
  | 'NO_CREDIT_HISTORY'
  | 'SINGLE_INCOME'
  | 'TARGETED'
  | 'CASH_POOR'
  | 'CLOCK_CURSED'
  | 'DISADVANTAGE_DRAFT';

export type ExtractionActionId =
  | 'MARKET_DUMP'
  | 'CREDIT_REPORT_PULL'
  | 'REGULATORY_FILING'
  | 'MISINFORMATION_FLOOD'
  | 'DEBT_INJECTION'
  | 'HOSTILE_TAKEOVER'
  | 'LIQUIDATION_NOTICE';

export type CounterCardId =
  | 'LIQUIDITY_WALL'
  | 'CREDIT_FREEZE'
  | 'EVIDENCE_FILE'
  | 'SIGNAL_CLEAR'
  | 'DEBT_SHIELD'
  | 'SOVEREIGNTY_LOCK'
  | 'FORCED_DRAW_BLOCK';

export type PsycheState = 'COMPOSED' | 'STRESSED' | 'CRACKING' | 'BREAKING' | 'DESPERATE';
export type VisibilityTier = 'SHADOWED' | 'SIGNALED' | 'TELEGRAPHED' | 'EXPOSED';
export type ModeEventLevel = 'INFO' | 'WARNING' | 'ALERT' | 'SUCCESS';
export type RunSplitDisposition = 'NONE' | 'TEAM_REMAINED' | 'DEFECTOR_SPLIT';

export interface ModeParticipant {
  playerId: string;
  snapshot: RunStateSnapshot;
  teamId: string | null;
  roleId: TeamRoleId | null;
  counters: CounterCardId[];
  metadata: Record<string, string | number | boolean | null>;
}

export interface SharedOpportunitySlot {
  slotId: string;
  cardId: string;
  introducedTick: number;
  refusalOwnerId: string | null;
  refusalExpiresTick: number;
  expiresTick: number;
  status: 'OPEN' | 'PURCHASED' | 'DISCARDED';
  purchasedBy: string | null;
}

export interface RivalryLedger {
  playerA: string;
  playerB: string;
  matchesPlayed: number;
  wins: Record<string, number>;
  archRivalUnlocked: boolean;
  nemesisUnlocked: boolean;
  carryHeatByPlayer: Record<string, number>;
}

export interface TrustAuditLine {
  playerId: string;
  trustScore: number;
  aidGivenCount: number;
  rescueCount: number;
  cascadeAbsorptions: number;
  loanRepaymentRate: number;
  defectionRiskSignal: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  notes: string[];
}

export interface SyndicateSharedState {
  treasuryBalance: number;
  freedomThreshold: number;
  freedPlayerIds: string[];
  defectedPlayerIds: string[];
  splitDisposition: RunSplitDisposition;
  trustAudit: Record<string, TrustAuditLine>;
}

export interface LegendBaseline {
  legendRunId: string;
  ownerUserId: string;
  seasonId: string;
  legendScore: number;
  originalHeat: number;
  daysAlive: number;
  communityRunsSince: number;
  markers: LegendMarker[];
  challengerScores: number[];
  challengerRunIds: string[];
  lastLegendCardId: string | null;
}

export interface ModeEvent {
  tick: number;
  level: ModeEventLevel;
  channel: 'SYSTEM' | 'TEAM' | 'SPECTATOR' | 'PRIVATE';
  actorId: string | null;
  code: string;
  message: string;
  payload?: Record<string, string | number | boolean | null>;
}

export interface CardPlayIntent {
  actorId: string;
  card: CardDefinition | CardInstance;
  timing: TimingClass;
  targetId?: string;
  targeting?: Targeting;
  declaredAtTick: number;
}

export interface CardDecisionAudit {
  actorId: string;
  cardId: string;
  mode: ModeCode;
  qualityScore: number;
  timingDeltaTicks: number;
  opportunityCost: number;
  notes: string[];
}

export interface ModeFrame {
  mode: ModeCode;
  tick: number;
  participants: ModeParticipant[];
  history: ModeEvent[];
  sharedThreats: ThreatEnvelope[];
  sharedOpportunitySlots: SharedOpportunitySlot[];
  rivalry: RivalryLedger | null;
  syndicate: SyndicateSharedState | null;
  legend: LegendBaseline | null;
}

export interface ModeValidationResult {
  ok: boolean;
  reason: string | null;
  warnings: string[];
}

export interface ModeFinalization {
  bonusMultiplier: number;
  flatBonus: number;
  badges: string[];
  audits: CardDecisionAudit[];
  notes: string[];
}

export interface ModeAdapter {
  readonly mode: ModeCode;
  bootstrap(frame: ModeFrame, options?: Record<string, unknown>): ModeFrame;
  onTickStart(frame: ModeFrame): ModeFrame;
  onTickEnd(frame: ModeFrame): ModeFrame;
  validateCardPlay(frame: ModeFrame, intent: CardPlayIntent): ModeValidationResult;
  applyCardOverlay(frame: ModeFrame, actorId: string, card: CardDefinition): CardInstance;
  resolveNamedAction(
    frame: ModeFrame,
    actorId: string,
    actionId: string,
    payload?: Record<string, unknown>,
  ): ModeFrame;
  finalize(frame: ModeFrame): ModeFinalization;
}
