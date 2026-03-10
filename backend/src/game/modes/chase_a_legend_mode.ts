// backend/src/game/modes/chase_a_legend_mode.ts

import { createHash } from 'node:crypto';
import { CardRegistry } from '../engine/card_registry';
import { GameMode } from '../engine/card_types';

/**
 * POINT ZERO ONE — CHASE A LEGEND MODE ENGINE
 * backend/src/game/modes/chase_a_legend_mode.ts
 *
 * Doctrine-aligned backend mode implementation for Phantom / CHASE A LEGEND.
 *
 * Core mechanics implemented:
 * - cryptographically anchored Legend baseline
 * - community heat modifier: legend_original_heat + (total_community_runs_since_legend * 0.003)
 * - Legend Decay injections by age milestone
 * - Legend Markers and Ghost Benchmark Windows (GBM) within ±3 ticks
 * - Ghost Vision (last played Legend card as contextual hint)
 * - real-time gap indicator and gap closing rate
 * - Card Replay Audit entries for every recorded player play
 * - Ghost Pass superior-decision notation logic
 * - Challenger / New Legend / Dynasty adjudication
 */

export type LegendIntegrityStatus = 'VERIFIED' | 'FAILED' | 'PENDING';
export type PhantomOutcome = 'FREEDOM' | 'TIMEOUT' | 'BANKRUPT';
export type PhantomResultTier = 'LOSS' | 'CHALLENGER' | 'NEW_LEGEND' | 'DYNASTY';

export type LegendMarkerColor = 'GOLD' | 'RED' | 'PURPLE' | 'SILVER' | 'BLACK';
export type GapArrow = '↑↑' | '↑' | '→' | '↓' | '↓↓';
export type DivergencePotential = 'LOW' | 'MEDIUM' | 'HIGH';
export type PhantomBadge = 'CHALLENGER' | 'SEASON_LEGEND' | 'DYNASTY';

export type DecayInjectionType =
  | 'EMERGENCY_EXPENSE'
  | 'INCOME_SEIZURE'
  | 'DEBT_SPIRAL'
  | 'MARKET_CORRECTION'
  | 'TAX_AUDIT'
  | 'SYSTEM_GLITCH';

export interface LegendMarker {
  readonly markerId: string;
  readonly tick: number;
  readonly color: LegendMarkerColor;
  readonly legendCardId?: string;
  readonly legendOutcomeNote: string;
  readonly legendCordImpact: number;
  readonly legendIncomeDelta?: number;
  readonly legendHeatDelta?: number;
}

export interface LegendTickSnapshot {
  readonly tick: number;
  readonly cord: number;
  readonly lastPlayedCardId?: string;
}

export interface ChallengerGhost {
  readonly challengerId: string;
  readonly cord: number;
  readonly proofHash: string;
}

export interface LegendBaseline {
  readonly legendId: string;
  readonly label: string;
  readonly sourceMode: GameMode;
  readonly seasonId: string;
  readonly outcome: PhantomOutcome;
  readonly integrityStatus: LegendIntegrityStatus;
  readonly proofHash: string;
  readonly originalHeat: number;
  readonly finalCord: number;
  readonly setAtEpochMs: number;
  readonly totalCommunityRunsSinceLegend: number;
  readonly challengeCount: number;
  readonly beatCount: number;
  readonly averageClosingGap: number;
  readonly markers: readonly LegendMarker[];
  readonly tickSnapshots: readonly LegendTickSnapshot[];
  readonly challengers: readonly ChallengerGhost[];
}

export interface DecayInjection {
  readonly milestoneHours: number;
  readonly injectionType: DecayInjectionType;
  readonly intensity: number;
  readonly botHeatFloorBonus: number;
}

export interface ActiveGhostWindow {
  readonly markerId: string;
  readonly color: LegendMarkerColor;
  readonly opensAtTick: number;
  readonly closesAtTick: number;
  readonly currentDistanceTicks: number;
  readonly legendCardId?: string;
}

export interface CardReplayAuditEntry {
  readonly auditId: string;
  readonly tick: number;
  readonly cardId: string;
  readonly totalCordDelta: number;
  readonly generatedIncomeDelta: number;
  readonly gapDelta: number;
  readonly divergencePotential: DivergencePotential;
  readonly gapArrow: GapArrow;
  readonly matchedMarkerId?: string;
  readonly matchedMarkerColor?: LegendMarkerColor;
  readonly usedGhostVision: boolean;
  readonly superiorDecision: boolean;
  readonly replayProofHashFragment?: string;
}

export interface PhantomPlayerState {
  readonly playerId: string;
  readonly displayName: string;
  readonly cash: number;
  readonly income: number;
  readonly expenses: number;
  readonly shields: number;
  readonly pressure: number;
  readonly currentCord: number;
  readonly currentGapVsLegend: number;
  readonly currentGapArrow: GapArrow;
  readonly gapClosingRate: number;
  readonly superiorDecisionNotations: number;
  readonly gbmWindowHits: number;
  readonly gbmWindowMisses: number;
  readonly activeBadges: readonly PhantomBadge[];
  readonly finalOutcome: PhantomOutcome | null;
  readonly finalTier: PhantomResultTier | null;
  readonly finalCordWithBonuses: number | null;
  readonly integrityVerified: boolean;
  readonly dynastyEligible: boolean;
  readonly challengeBeatenCount: number;
  readonly replayAudit: readonly CardReplayAuditEntry[];
}

export interface PhantomMacroState {
  readonly tick: number;
  readonly currentTimeMs: number;
  readonly legendAgeHours: number;
  readonly effectiveHeatModifier: number;
  readonly activeDecayInjections: readonly DecayInjection[];
  readonly activeGhostWindows: readonly ActiveGhostWindow[];
  readonly ghostVisionCardId: string | null;
  readonly historicalDifficultyRating: number;
  readonly latestLegendGap: number;
  readonly latestLegendCord: number;
  readonly eventLog: readonly string[];
}

export interface ChaseALegendModeState {
  readonly runId: string;
  readonly seed: string;
  readonly mode: GameMode.CHASE_A_LEGEND;
  readonly legend: LegendBaseline;
  readonly player: PhantomPlayerState;
  readonly macro: PhantomMacroState;
}

export interface AdvanceTickAction {
  readonly type: 'ADVANCE_TICK';
  readonly timestampMs?: number;
  readonly cashDelta?: number;
  readonly incomeDelta?: number;
  readonly expenseDelta?: number;
  readonly shieldDelta?: number;
  readonly pressureDelta?: number;
}

export interface RecordPlayerCardPlayAction {
  readonly type: 'RECORD_PLAYER_CARD_PLAY';
  readonly tick: number;
  readonly cardId: string;
  readonly totalCordDelta: number;
  readonly generatedIncomeDelta?: number;
  readonly replayProofHashFragment?: string;
  readonly usedGhostVision?: boolean;
  readonly outperformedLegendChoice?: boolean;
}

export interface RecordFreedomAction {
  readonly type: 'RECORD_FREEDOM';
  readonly proofHash: string;
  readonly integrityVerified: boolean;
  readonly finalCord: number;
  readonly outcome: PhantomOutcome;
  readonly challengersBeaten: number;
}

export type ChaseALegendModeAction =
  | AdvanceTickAction
  | RecordPlayerCardPlayAction
  | RecordFreedomAction;

const COMMUNITY_HEAT_PER_RUN = 0.003;
const GBM_RADIUS_TICKS = 3;

const DECAY_SCHEDULE: readonly DecayInjection[] = [
  {
    milestoneHours: 72,
    injectionType: 'EMERGENCY_EXPENSE',
    intensity: 0.4,
    botHeatFloorBonus: 0,
  },
  {
    milestoneHours: 24 * 7,
    injectionType: 'INCOME_SEIZURE',
    intensity: 0.5,
    botHeatFloorBonus: 0,
  },
  {
    milestoneHours: 24 * 14,
    injectionType: 'DEBT_SPIRAL',
    intensity: 0.6,
    botHeatFloorBonus: 0,
  },
  {
    milestoneHours: 24 * 30,
    injectionType: 'MARKET_CORRECTION',
    intensity: 0.7,
    botHeatFloorBonus: 0,
  },
  {
    milestoneHours: 24 * 90,
    injectionType: 'TAX_AUDIT',
    intensity: 0.8,
    botHeatFloorBonus: 20,
  },
  {
    milestoneHours: 24 * 180,
    injectionType: 'SYSTEM_GLITCH',
    intensity: 1.0,
    botHeatFloorBonus: 50,
  },
] as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function stableId(prefix: string, ...parts: readonly Array<string | number>): string {
  const hash = createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 16);
  return `${prefix}_${hash}`;
}

function resolveLegendCordAtTick(legend: LegendBaseline, tick: number): number {
  const exact = legend.tickSnapshots.find((entry) => entry.tick === tick);
  if (exact) {
    return exact.cord;
  }

  const sorted = [...legend.tickSnapshots].sort((a, b) => a.tick - b.tick);
  let latest = sorted[0]?.cord ?? legend.finalCord;

  for (const snapshot of sorted) {
    if (snapshot.tick > tick) {
      break;
    }
    latest = snapshot.cord;
  }

  return latest;
}

function resolveGhostVisionCardId(legend: LegendBaseline, tick: number): string | null {
  const sorted = [...legend.tickSnapshots].sort((a, b) => a.tick - b.tick);
  let latest: string | null = null;

  for (const snapshot of sorted) {
    if (snapshot.tick > tick) {
      break;
    }
    if (snapshot.lastPlayedCardId) {
      latest = snapshot.lastPlayedCardId;
    }
  }

  return latest;
}

function resolveActiveDecayInjections(legendAgeHours: number): DecayInjection[] {
  return DECAY_SCHEDULE.filter((entry) => legendAgeHours >= entry.milestoneHours);
}

function resolveHistoricalDifficultyRating(legend: LegendBaseline, legendAgeHours: number): number {
  const decayLevel = resolveActiveDecayInjections(legendAgeHours).length;
  const beatRate = legend.challengeCount <= 0 ? 0 : legend.beatCount / legend.challengeCount;
  const survivalBias = 1 - clamp(beatRate, 0, 1);
  const challengePressure = Math.min(1, legend.challengeCount / 1000);
  const gapPressure = Math.min(1, legend.averageClosingGap / 0.2);
  const heatPressure = Math.min(
    1,
    (legend.originalHeat + legend.totalCommunityRunsSinceLegend * COMMUNITY_HEAT_PER_RUN) / 600,
  );

  return Math.round(
    clamp(
      100 * (decayLevel * 0.12 + survivalBias * 0.28 + challengePressure * 0.2 + gapPressure * 0.12 + heatPressure * 0.28),
      1,
      100,
    ),
  );
}

function resolveActiveGhostWindows(legend: LegendBaseline, tick: number): ActiveGhostWindow[] {
  return legend.markers
    .filter((marker) => Math.abs(marker.tick - tick) <= GBM_RADIUS_TICKS)
    .map((marker) => ({
      markerId: marker.markerId,
      color: marker.color,
      opensAtTick: marker.tick - GBM_RADIUS_TICKS,
      closesAtTick: marker.tick + GBM_RADIUS_TICKS,
      currentDistanceTicks: Math.abs(marker.tick - tick),
      legendCardId: marker.legendCardId,
    }))
    .sort((left, right) => left.currentDistanceTicks - right.currentDistanceTicks);
}

function gapArrowFromDelta(delta: number): GapArrow {
  if (delta >= 0.04) {
    return '↑↑';
  }
  if (delta >= 0.005) {
    return '↑';
  }
  if (delta <= -0.04) {
    return '↓↓';
  }
  if (delta <= -0.005) {
    return '↓';
  }
  return '→';
}

function divergenceFromPlay(
  cardId: string,
  matchedMarker: LegendMarker | undefined,
  totalCordDelta: number,
): DivergencePotential {
  const normalizedCardId = cardId.toLowerCase();

  if (
    normalizedCardId.includes('ghost') ||
    normalizedCardId.includes('legend') ||
    normalizedCardId.includes('cascade_break') ||
    matchedMarker?.color === 'SILVER' ||
    matchedMarker?.color === 'BLACK'
  ) {
    return 'HIGH';
  }

  if (
    matchedMarker ||
    normalizedCardId.includes('discipline') ||
    Math.abs(totalCordDelta) >= 0.015
  ) {
    return 'MEDIUM';
  }

  return 'LOW';
}

function computePlayerGapVsLegend(currentCord: number, legendCord: number): number {
  return round6(currentCord - legendCord);
}

function computeGapClosingRate(previousGap: number, nextGap: number): number {
  return round6(previousGap - nextGap);
}

function adjudicateResult(input: {
  readonly legendFinalCord: number;
  readonly finalCord: number;
  readonly outcome: PhantomOutcome;
  readonly integrityVerified: boolean;
  readonly challengersBeaten: number;
}): {
  readonly tier: PhantomResultTier;
  readonly bonusMultiplier: number;
  readonly badges: readonly PhantomBadge[];
  readonly dynastyEligible: boolean;
} {
  if (input.outcome !== 'FREEDOM' || !input.integrityVerified) {
    return {
      tier: 'LOSS',
      bonusMultiplier: 1,
      badges: [],
      dynastyEligible: false,
    };
  }

  const improvement = input.legendFinalCord <= 0
    ? 0
    : (input.finalCord - input.legendFinalCord) / input.legendFinalCord;

  if (improvement > 0.2 && input.challengersBeaten >= 3) {
    return {
      tier: 'DYNASTY',
      bonusMultiplier: 2,
      badges: ['CHALLENGER', 'SEASON_LEGEND', 'DYNASTY'],
      dynastyEligible: true,
    };
  }

  if (improvement >= 0.05) {
    return {
      tier: 'NEW_LEGEND',
      bonusMultiplier: 1 + clamp(improvement, 0.05, 0.75),
      badges: ['SEASON_LEGEND'],
      dynastyEligible: input.challengersBeaten >= 3,
    };
  }

  if (improvement > 0) {
    return {
      tier: 'CHALLENGER',
      bonusMultiplier: 1.2,
      badges: ['CHALLENGER'],
      dynastyEligible: input.challengersBeaten >= 3,
    };
  }

  return {
    tier: 'LOSS',
    bonusMultiplier: 1,
    badges: [],
    dynastyEligible: false,
  };
}

function mutatePlayer(
  state: ChaseALegendModeState,
  transform: (player: PhantomPlayerState) => PhantomPlayerState,
): ChaseALegendModeState {
  return {
    ...state,
    player: transform(state.player),
  };
}

function appendEvent(
  state: ChaseALegendModeState,
  detail: string,
): ChaseALegendModeState {
  return {
    ...state,
    macro: {
      ...state.macro,
      eventLog: [...state.macro.eventLog, detail],
    },
  };
}

function advanceTick(
  state: ChaseALegendModeState,
  action: AdvanceTickAction,
): ChaseALegendModeState {
  const nextTick = state.macro.tick + 1;
  const nextTimeMs = action.timestampMs ?? state.macro.currentTimeMs + 1000;
  const legendAgeHours = Math.max(0, (nextTimeMs - state.legend.setAtEpochMs) / 3_600_000);
  const activeDecayInjections = resolveActiveDecayInjections(legendAgeHours);
  const decayHeatBonus = activeDecayInjections.reduce(
    (sum, entry) => sum + entry.botHeatFloorBonus,
    0,
  );

  const effectiveHeatModifier = round6(
    state.legend.originalHeat +
      state.legend.totalCommunityRunsSinceLegend * COMMUNITY_HEAT_PER_RUN +
      decayHeatBonus,
  );

  const legendCord = resolveLegendCordAtTick(state.legend, nextTick);
  const ghostVisionCardId = resolveGhostVisionCardId(state.legend, nextTick);
  const activeGhostWindows = resolveActiveGhostWindows(state.legend, nextTick);

  const nextCash = Math.max(
    0,
    state.player.cash + (action.cashDelta ?? 0) + state.player.income - state.player.expenses,
  );
  const nextIncome = Math.max(0, state.player.income + (action.incomeDelta ?? 0));
  const nextExpenses = Math.max(0, state.player.expenses + (action.expenseDelta ?? 0));
  const nextShields = Math.max(0, state.player.shields + (action.shieldDelta ?? 0));
  const heatPressure = effectiveHeatModifier / 100;
  const nextPressure = clamp(
    state.player.pressure + heatPressure + (action.pressureDelta ?? 0),
    0,
    100,
  );
  const nextGap = computePlayerGapVsLegend(state.player.currentCord, legendCord);
  const gapClosingRate = computeGapClosingRate(state.player.currentGapVsLegend, nextGap);

  let next: ChaseALegendModeState = {
    ...state,
    player: {
      ...state.player,
      cash: nextCash,
      income: nextIncome,
      expenses: nextExpenses,
      shields: nextShields,
      pressure: nextPressure,
      currentGapVsLegend: nextGap,
      gapClosingRate,
      currentGapArrow: gapArrowFromDelta(gapClosingRate),
    },
    macro: {
      ...state.macro,
      tick: nextTick,
      currentTimeMs: nextTimeMs,
      legendAgeHours,
      effectiveHeatModifier,
      activeDecayInjections,
      activeGhostWindows,
      ghostVisionCardId,
      historicalDifficultyRating: resolveHistoricalDifficultyRating(state.legend, legendAgeHours),
      latestLegendGap: nextGap,
      latestLegendCord: legendCord,
    },
  };

  return appendEvent(
    next,
    `tick=${nextTick};legend_cord=${legendCord.toFixed(6)};gap=${nextGap.toFixed(6)};heat=${effectiveHeatModifier.toFixed(3)}`,
  );
}

function recordPlayerCardPlay(
  state: ChaseALegendModeState,
  action: RecordPlayerCardPlayAction,
  registry: CardRegistry,
): ChaseALegendModeState {
  registry.getOrThrow(action.cardId);

  const matchedWindow = resolveActiveGhostWindows(state.legend, action.tick)[0];
  const matchedMarker = matchedWindow
    ? state.legend.markers.find((marker) => marker.markerId === matchedWindow.markerId)
    : undefined;

  const superiorDecision =
    Boolean(action.outperformedLegendChoice) ||
    (matchedMarker?.color === 'RED' &&
      action.cardId.toLowerCase().includes('ghost_pass') &&
      (action.generatedIncomeDelta ?? 0) > 1500);

  const divergencePotential = divergenceFromPlay(
    action.cardId,
    matchedMarker,
    action.totalCordDelta,
  );

  const markerBonus =
    matchedMarker?.color === 'SILVER'
      ? 0.015
      : matchedMarker?.color === 'GOLD'
      ? 0.01
      : matchedMarker?.color === 'PURPLE'
      ? 0.008
      : matchedMarker?.color === 'BLACK'
      ? 0.02
      : 0;

  const superiorBonus = superiorDecision ? 0.04 : 0;
  const divergenceMultiplier =
    divergencePotential === 'HIGH' ? 1.5 : divergencePotential === 'MEDIUM' ? 1.15 : 1;

  const ghostDelta = round6((action.totalCordDelta + markerBonus + superiorBonus) * divergenceMultiplier);
  const nextCord = round6(state.player.currentCord + ghostDelta);
  const legendCord = resolveLegendCordAtTick(state.legend, action.tick);
  const nextGap = computePlayerGapVsLegend(nextCord, legendCord);
  const gapDelta = round6(nextGap - state.player.currentGapVsLegend);
  const gapClosingRate = computeGapClosingRate(state.player.currentGapVsLegend, nextGap);
  const gapArrow = gapArrowFromDelta(gapDelta);

  const auditEntry: CardReplayAuditEntry = {
    auditId: stableId('audit', state.runId, action.tick, action.cardId, state.player.replayAudit.length),
    tick: action.tick,
    cardId: action.cardId,
    totalCordDelta: round6(action.totalCordDelta),
    generatedIncomeDelta: round6(action.generatedIncomeDelta ?? 0),
    gapDelta,
    divergencePotential,
    gapArrow,
    matchedMarkerId: matchedMarker?.markerId,
    matchedMarkerColor: matchedMarker?.color,
    usedGhostVision: Boolean(action.usedGhostVision && state.macro.ghostVisionCardId),
    superiorDecision,
    replayProofHashFragment: action.replayProofHashFragment,
  };

  let next: ChaseALegendModeState = {
    ...state,
    player: {
      ...state.player,
      currentCord: nextCord,
      currentGapVsLegend: nextGap,
      currentGapArrow: gapArrow,
      gapClosingRate,
      superiorDecisionNotations:
        state.player.superiorDecisionNotations + (superiorDecision ? 1 : 0),
      gbmWindowHits:
        state.player.gbmWindowHits + (matchedMarker ? 1 : 0),
      gbmWindowMisses:
        state.player.gbmWindowMisses + (matchedMarker ? 0 : 1),
      replayAudit: [...state.player.replayAudit, auditEntry],
    },
    macro: {
      ...state.macro,
      latestLegendGap: nextGap,
      latestLegendCord: legendCord,
    },
  };

  if (matchedMarker?.color === 'SILVER') {
    next = mutatePlayer(next, (player) => ({
      ...player,
      shields: player.shields + 12,
    }));
  }

  return appendEvent(
    next,
    `card=${action.cardId};tick=${action.tick};ghost_delta=${ghostDelta.toFixed(6)};gap=${nextGap.toFixed(6)};marker=${matchedMarker?.color ?? 'none'};superior=${superiorDecision}`,
  );
}

function recordFreedom(
  state: ChaseALegendModeState,
  action: RecordFreedomAction,
): ChaseALegendModeState {
  const adjudicated = adjudicateResult({
    legendFinalCord: state.legend.finalCord,
    finalCord: action.finalCord,
    outcome: action.outcome,
    integrityVerified: action.integrityVerified,
    challengersBeaten: action.challengersBeaten,
  });

  const finalCordWithBonuses = round6(action.finalCord * adjudicated.bonusMultiplier);

  const next: ChaseALegendModeState = {
    ...state,
    player: {
      ...state.player,
      currentCord: round6(action.finalCord),
      currentGapVsLegend: computePlayerGapVsLegend(action.finalCord, state.legend.finalCord),
      currentGapArrow: gapArrowFromDelta(action.finalCord - state.legend.finalCord),
      finalOutcome: action.outcome,
      finalTier: adjudicated.tier,
      finalCordWithBonuses,
      integrityVerified: action.integrityVerified,
      activeBadges: adjudicated.badges,
      dynastyEligible: adjudicated.dynastyEligible,
      challengeBeatenCount: action.challengersBeaten,
    },
    macro: {
      ...state.macro,
      latestLegendGap: computePlayerGapVsLegend(action.finalCord, state.legend.finalCord),
      latestLegendCord: state.legend.finalCord,
    },
  };

  return appendEvent(
    next,
    `run_complete;outcome=${action.outcome};tier=${adjudicated.tier};final_cord=${action.finalCord.toFixed(6)};bonus_cord=${finalCordWithBonuses.toFixed(6)}`,
  );
}

export class ChaseALegendModeEngine {
  private state: ChaseALegendModeState;
  private readonly registry: CardRegistry;

  public constructor(
    initialState: ChaseALegendModeState,
    registry: CardRegistry = new CardRegistry(),
  ) {
    this.registry = registry;
    this.state = initialState;
  }

  public getState(): ChaseALegendModeState {
    return this.state;
  }

  public dispatch(action: ChaseALegendModeAction): ChaseALegendModeState {
    switch (action.type) {
      case 'ADVANCE_TICK':
        this.state = advanceTick(this.state, action);
        return this.state;

      case 'RECORD_PLAYER_CARD_PLAY':
        this.state = recordPlayerCardPlay(this.state, action, this.registry);
        return this.state;

      case 'RECORD_FREEDOM':
        this.state = recordFreedom(this.state, action);
        return this.state;

      default: {
        const exhaustive: never = action;
        return exhaustive;
      }
    }
  }
}

export function createInitialChaseALegendModeState(input: {
  readonly runId: string;
  readonly seed: string;
  readonly currentTimeMs: number;
  readonly legend: LegendBaseline;
  readonly player: {
    readonly playerId: string;
    readonly displayName: string;
    readonly cash: number;
    readonly income: number;
    readonly expenses: number;
    readonly shields?: number;
    readonly pressure?: number;
  };
}): ChaseALegendModeState {
  const legendAgeHours = Math.max(0, (input.currentTimeMs - input.legend.setAtEpochMs) / 3_600_000);
  const activeDecayInjections = resolveActiveDecayInjections(legendAgeHours);
  const effectiveHeatModifier = round6(
    input.legend.originalHeat +
      input.legend.totalCommunityRunsSinceLegend * COMMUNITY_HEAT_PER_RUN +
      activeDecayInjections.reduce((sum, entry) => sum + entry.botHeatFloorBonus, 0),
  );
  const initialLegendCord = resolveLegendCordAtTick(input.legend, 0);

  return {
    runId: input.runId,
    seed: input.seed,
    mode: GameMode.CHASE_A_LEGEND,
    legend: input.legend,
    player: {
      playerId: input.player.playerId,
      displayName: input.player.displayName,
      cash: Math.max(0, input.player.cash),
      income: Math.max(0, input.player.income),
      expenses: Math.max(0, input.player.expenses),
      shields: Math.max(0, input.player.shields ?? 100),
      pressure: clamp(input.player.pressure ?? 0, 0, 100),
      currentCord: 0,
      currentGapVsLegend: computePlayerGapVsLegend(0, initialLegendCord),
      currentGapArrow: '→',
      gapClosingRate: 0,
      superiorDecisionNotations: 0,
      gbmWindowHits: 0,
      gbmWindowMisses: 0,
      activeBadges: [],
      finalOutcome: null,
      finalTier: null,
      finalCordWithBonuses: null,
      integrityVerified: false,
      dynastyEligible: false,
      challengeBeatenCount: 0,
      replayAudit: [],
    },
    macro: {
      tick: 0,
      currentTimeMs: input.currentTimeMs,
      legendAgeHours,
      effectiveHeatModifier,
      activeDecayInjections,
      activeGhostWindows: resolveActiveGhostWindows(input.legend, 0),
      ghostVisionCardId: resolveGhostVisionCardId(input.legend, 0),
      historicalDifficultyRating: resolveHistoricalDifficultyRating(input.legend, legendAgeHours),
      latestLegendGap: computePlayerGapVsLegend(0, initialLegendCord),
      latestLegendCord: initialLegendCord,
      eventLog: [],
    },
  };
}