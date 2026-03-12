/*
 * POINT ZERO ONE — BACKEND ENGINE CORE
 * /backend/src/game/engine/core/RunStateSnapshot.ts
 *
 * Doctrine:
 * - backend snapshots are immutable read models, not writable live state
 * - semantic pressure and tick cadence must both be preserved
 * - mode truth remains backend-owned, but snapshots still carry enough
 *   shape to align with frontend engine doctrine
 * - every field here is serialization-safe and deterministic-hash friendly
 * - additive expansion is preferred over breaking renames
 */

import type {
  AttackEvent,
  BotState,
  CardInstance,
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
  TimingClass,
} from './GamePrimitives';

export type ModePresentationCode =
  | 'empire'
  | 'predator'
  | 'syndicate'
  | 'phantom';

export type PressureBand =
  | 'CALM'
  | 'BUILDING'
  | 'ELEVATED'
  | 'HIGH'
  | 'CRITICAL';

export type OutcomeReasonCode =
  | 'TARGET_REACHED'
  | 'SEASON_BUDGET_EXHAUSTED'
  | 'NET_WORTH_COLLAPSE'
  | 'USER_ABANDON'
  | 'ENGINE_ABORT'
  | 'INTEGRITY_QUARANTINE'
  | 'UNKNOWN';

export type DecisionWindowMetadataValue =
  | string
  | number
  | boolean
  | null;

export interface RuntimeDecisionWindowSnapshot {
  readonly id: string;
  readonly timingClass: TimingClass;
  readonly label: string;
  readonly source: string;
  readonly mode: ModeCode;
  readonly openedAtTick: number;
  readonly openedAtMs: number;
  readonly closesAtTick: number | null;
  readonly closesAtMs: number | null;
  readonly exclusive: boolean;
  readonly frozen: boolean;
  readonly consumed: boolean;
  readonly actorId: string | null;
  readonly targetActorId: string | null;
  readonly cardInstanceId: string | null;
  readonly metadata: Readonly<Record<string, DecisionWindowMetadataValue>>;
}

export interface ShieldLayerState {
  readonly layerId: ShieldLayerId;
  readonly label: ShieldLayerLabel;
  readonly current: number;
  readonly max: number;
  readonly regenPerTick: number;
  readonly breached: boolean;
  readonly integrityRatio: number;
  readonly lastDamagedTick: number | null;
  readonly lastRecoveredTick: number | null;
}

export interface EconomyState {
  readonly cash: number;
  readonly debt: number;
  readonly incomePerTick: number;
  readonly expensesPerTick: number;
  readonly netWorth: number;
  readonly freedomTarget: number;
  readonly haterHeat: number;
  readonly opportunitiesPurchased: number;
  readonly privilegePlays: number;
}

export interface PressureState {
  /**
   * Normalized semantic pressure score.
   * 0.0 = calm, 1.0 = catastrophic.
   */
  readonly score: number;

  /**
   * Backend cadence tier retained for engine/runtime compatibility.
   * Canonical values remain T0..T4.
   */
  readonly tier: PressureTier;

  /**
   * Rich semantic pressure band aligned with the frontend doctrine.
   */
  readonly band: PressureBand;

  readonly previousTier: PressureTier;
  readonly previousBand: PressureBand;
  readonly upwardCrossings: number;
  readonly survivedHighPressureTicks: number;
  readonly lastEscalationTick: number | null;
  readonly maxScoreSeen: number;
}

export interface TensionState {
  readonly score: number;
  readonly anticipation: number;
  readonly visibleThreats: readonly ThreatEnvelope[];
  readonly maxPulseTriggered: boolean;
  readonly lastSpikeTick: number | null;
}

export interface ShieldState {
  readonly layers: readonly ShieldLayerState[];
  readonly weakestLayerId: ShieldLayerId;
  readonly weakestLayerRatio: number;
  readonly blockedThisRun: number;
  readonly damagedThisRun: number;
  readonly breachesThisRun: number;
  readonly repairQueueDepth: number;
}

export interface BotRuntimeState {
  readonly botId: HaterBotId;
  readonly label: string;
  readonly state: BotState;
  readonly heat: number;
  readonly lastAttackTick: number | null;
  readonly attacksLanded: number;
  readonly attacksBlocked: number;
  readonly neutralized: boolean;
}

export interface BattleState {
  readonly bots: readonly BotRuntimeState[];
  readonly battleBudget: number;
  readonly battleBudgetCap: number;
  readonly extractionCooldownTicks: number;
  readonly firstBloodClaimed: boolean;
  readonly pendingAttacks: readonly AttackEvent[];
  readonly sharedOpportunityDeckCursor: number;
  readonly rivalryHeatCarry: number;
  readonly neutralizedBotIds: readonly HaterBotId[];
}

export interface CascadeState {
  readonly activeChains: readonly CascadeChainInstance[];
  readonly positiveTrackers: readonly string[];
  readonly brokenChains: number;
  readonly completedChains: number;
  readonly repeatedTriggerCounts: Readonly<Record<string, number>>;
  readonly lastResolvedTick: number | null;
}

export interface SovereigntyState {
  readonly integrityStatus: IntegrityStatus;
  readonly tickChecksums: readonly string[];
  readonly proofHash: string | null;
  readonly sovereigntyScore: number;
  readonly verifiedGrade: string | null;
  readonly proofBadges: readonly string[];
  readonly gapVsLegend: number;
  readonly gapClosingRate: number;
  readonly cordScore: number;
  readonly auditFlags: readonly string[];
  readonly lastVerifiedTick: number | null;
}

export interface CardsState {
  readonly hand: readonly CardInstance[];
  readonly discard: readonly string[];
  readonly exhaust: readonly string[];
  readonly drawHistory: readonly string[];
  readonly lastPlayed: readonly string[];
  readonly ghostMarkers: readonly LegendMarker[];
  readonly drawPileSize: number;
  readonly deckEntropy: number;
}

export interface ModeState {
  readonly holdEnabled: boolean;
  readonly loadoutEnabled: boolean;
  readonly sharedTreasury: boolean;
  readonly sharedTreasuryBalance: number;
  readonly trustScores: Readonly<Record<string, number>>;
  readonly roleAssignments: Readonly<Record<string, string>>;
  readonly defectionStepByPlayer: Readonly<Record<string, number>>;
  readonly legendMarkersEnabled: boolean;
  readonly communityHeatModifier: number;
  readonly sharedOpportunityDeck: boolean;
  readonly counterIntelTier: number;
  readonly spectatorLimit: number;
  readonly phaseBoundaryWindowsRemaining: number;
  readonly bleedMode: boolean;
  readonly handicapIds: readonly string[];
  readonly advantageId: string | null;
  readonly disabledBots: readonly HaterBotId[];
  readonly modePresentation: ModePresentationCode;
  readonly roleLockEnabled: boolean;
  readonly extractionActionsRemaining: number;
  readonly ghostBaselineRunId: string | null;
  readonly legendOwnerUserId: string | null;
}

export interface TimerState {
  readonly seasonBudgetMs: number;
  readonly extensionBudgetMs: number;
  readonly elapsedMs: number;
  readonly currentTickDurationMs: number;
  readonly nextTickAtMs: number | null;
  readonly holdCharges: number;

  /**
   * Canonical runtime-owned timing windows.
   * This is intentionally the structured decision-window store, not a
   * numeric deadline map.
   */
  readonly activeDecisionWindows: Readonly<
    Record<string, RuntimeDecisionWindowSnapshot>
  >;

  /**
   * Convenience projection used by runtime/UI/debug consumers that need
   * frozen-window IDs without re-scanning the full store.
   */
  readonly frozenWindowIds: readonly string[];

  /**
   * Optional additive fields for richer cadence diagnostics. These are
   * intentionally optional so older factories remain source-compatible.
   */
  readonly lastTierChangeTick?: number | null;
  readonly tierInterpolationRemainingTicks?: number;
  readonly forcedTierOverride?: PressureTier | null;
}

export type TimersState = TimerState;

export interface DecisionRecord {
  readonly tick: number;
  readonly actorId: string;
  readonly cardId: string;
  readonly latencyMs: number;
  readonly timingClass: readonly string[];
  readonly accepted: boolean;
}

export interface TelemetryState {
  readonly decisions: readonly DecisionRecord[];
  readonly outcomeReason: string | null;
  readonly outcomeReasonCode: OutcomeReasonCode | null;
  readonly lastTickChecksum: string | null;
  readonly forkHints: readonly string[];
  readonly emittedEventCount: number;
  readonly warnings: readonly string[];
}

export interface RunStateSnapshot {
  readonly schemaVersion: 'engine-run-state.v2';
  readonly runId: string;
  readonly userId: string;
  readonly seed: string;
  readonly mode: ModeCode;
  readonly tick: number;
  readonly phase: RunPhase;
  readonly outcome: RunOutcome | null;
  readonly tags: readonly string[];
  readonly economy: EconomyState;
  readonly pressure: PressureState;
  readonly tension: TensionState;
  readonly shield: ShieldState;
  readonly battle: BattleState;
  readonly cascade: CascadeState;
  readonly sovereignty: SovereigntyState;
  readonly cards: CardsState;
  readonly modeState: ModeState;
  readonly timers: TimerState;
  readonly telemetry: TelemetryState;
}