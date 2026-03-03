// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — game/modes/phantom/PhantomModeEngine.ts
// Sprint 7 — Phantom Mode Engine (new — master orchestrator)
//
// Single entry point for all Phantom mode state.
// Owned by the run loop (useRunLoop.ts) — called once per tick.
//
// Architecture:
//   PhantomModeEngine.onTick()
//     → ghostReplayEngine.updateGhostAtTick()
//     → gapIndicatorEngine.updateGapIndicator()
//     → dynastyChallengeStack.pruneExpiredChallenges()
//     → legendDecayModel.applyLegendDecay() (server-driven, not every tick)
//     → phantomCommunityHeat.applyHeatUpdate() (server-driven)
//     → phantomEventBridge.emit*()
//
// Output: PhantomRunState — consumed by PhantomGameScreen via usePhantomState()
//
// Performance contract: onTick() < 1ms for 20M concurrent runs.
// All sub-engines are pure functions with no side effects.
//
// Density6 LLC · Confidential
// ═══════════════════════════════════════════════════════════════════════════

import { PHANTOM_CONFIG } from './phantomConfig';

import {
  type GhostState,
  type GhostTimeline,
  INITIAL_GHOST_STATE,
  loadGhostTimeline,
  updateGhostAtTick,
  computeGapCardBonus,
  type GapCardBonus,
} from './ghostReplayEngine';

import {
  type GapIndicatorState,
  INITIAL_GAP_STATE,
  updateGapIndicator,
  type GapZone,
} from './gapIndicatorEngine';

import {
  type LegendDecayState,
  type LegendRecord,
  INITIAL_DECAY_STATE,
  registerLegend,
  applyLegendDecay,
  recordLegendBeaten,
  recordDynastyDefense,
  markChallengeActive,
  setCommunityHeatMultiplier,
  getLegendsSortedByTier,
  isLegendChallengeable,
} from './legendDecayModel';

import {
  type DynastyChallengeStack,
  createDynastyStack,
  joinChallengeStack,
  startChallenge,
  resolveChallenge,
  pruneExpiredChallenges,
  isDynastyPressureActive,
} from './dynastyChallengeStack';

import {
  type CommunityHeatState,
  createHeatState,
  applyHeatUpdate,
  shouldRefreshHeat,
} from './phantomCommunityHeat';

import {
  type ProofBadgeState,
  INITIAL_PROOF_STATE,
  generateProofBadge,
  addBadge,
  markBadgeVerified,
} from './phantomProofSystem';

import {
  type PhantomCardContext,
  computePhantomCardModifiers,
  collapseModifiers,
} from './phantomCardAdapter';

import type { EventBus } from '../../engines/core/EventBus';
import {
  emitGhostDelta,
  emitGapZoneChanged,
  emitNerveEligible,
  emitLegendBeaten,
  emitDynastyPressure,
  emitProofBadgeEarned,
  emitGhostLoaded,
} from './phantomEventBridge';

// ── Phantom Run State (published to PhantomGameScreen) ─────────────────────────

export interface PhantomRunState {
  ghost:   GhostState;
  gap:     GapIndicatorState;
  decay:   LegendDecayState;
  dynasty: DynastyChallengeStack;
  heat:    CommunityHeatState;
  proof:   ProofBadgeState;

  /** Current target legend (null if none loaded) */
  activeLegend: LegendRecord | null;

  /** True once the player has beaten the active legend this run */
  legendBeatenThisRun: boolean;

  /** Sorted leaderboard snapshot for the legend select screen */
  leaderboard: LegendRecord[];
}

export interface PhantomEngineConfig {
  seed:        number;
  legendId:    string;
  bus:         EventBus;
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function createPhantomRunState(config: PhantomEngineConfig): PhantomRunState {
  return {
    ghost:               INITIAL_GHOST_STATE,
    gap:                 INITIAL_GAP_STATE,
    decay:               INITIAL_DECAY_STATE,
    dynasty:             createDynastyStack(config.legendId),
    heat:                createHeatState(config.seed),
    proof:               INITIAL_PROOF_STATE,
    activeLegend:        null,
    legendBeatenThisRun: false,
    leaderboard:         [],
  };
}

// ── Tick Handler ──────────────────────────────────────────────────────────────

export interface PhantomTickInput {
  tick:            number;
  playerNetWorth:  number;
  playerCordScore: number;
  playerCash:      number;
}

export function onPhantomTick(
  state: PhantomRunState,
  input: PhantomTickInput,
  bus:   EventBus,
): PhantomRunState {
  const { tick, playerNetWorth, playerCordScore } = input;

  let { ghost, gap, dynasty, heat, decay, proof, activeLegend, legendBeatenThisRun } = state;

  // ── Only patch ghost every N ticks ───────────────────────────────────────
  if (tick % PHANTOM_CONFIG.ghostTimelinePatchInterval === 0 && ghost.timeline) {
    const prevGapPct = ghost.netWorthGapPct;
    const wasAhead   = ghost.isAhead;

    ghost = updateGhostAtTick(ghost, tick, playerNetWorth, playerCordScore);

    // ── Gap indicator update ────────────────────────────────────────────────
    const prevCommittedZone = gap.committedZone;
    gap = updateGapIndicator(gap, ghost.netWorthGapPct, ghost.cordGapPct, prevGapPct);

    // ── Zone changed event ──────────────────────────────────────────────────
    if (gap.committedZone !== prevCommittedZone) {
      emitGapZoneChanged(bus, prevCommittedZone, gap.committedZone, gap.netWorthGapPct, tick);
    }

    // ── Ahead / behind transition events ───────────────────────────────────
    if (ghost.isAhead !== wasAhead) {
      if (ghost.isAhead) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (bus.emit as any)('PHANTOM_AHEAD_OF_GHOST', { tick, netWorthGap: ghost.netWorthGap });
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (bus.emit as any)('PHANTOM_BEHIND_GHOST', { tick, netWorthGap: ghost.netWorthGap });
      }
    }

    // ── Ghost delta emit ────────────────────────────────────────────────────
    emitGhostDelta(bus, ghost, tick);

    // ── Nerve eligible emit ────────────────────────────────────────────────
    if (gap.nerve.eligible && gap.nerve.streakTicks === 1) {
      emitNerveEligible(bus, gap, tick);
    }

    // ── Legend beaten check ────────────────────────────────────────────────
    if (!legendBeatenThisRun && ghost.isAhead && activeLegend) {
      legendBeatenThisRun = true;

      const badge = generateProofBadge(
        `run-${tick}`,
        state.heat.seed,
        activeLegend.legendId,
        activeLegend.displayName,
        playerNetWorth,
        activeLegend.finalNetWorth,
        playerCordScore,
        activeLegend.finalCordScore,
        tick,
      );

      if (badge) {
        proof = addBadge(proof, badge);
        emitProofBadgeEarned(bus, badge, tick);
      }

      decay = recordLegendBeaten(decay, activeLegend.legendId, 'player');
      emitLegendBeaten(bus, activeLegend, ghost.netWorthGapPct, badge?.proofHash ?? '', tick);
    }
  }

  // ── Dynasty expiry GC (every 60 ticks) ───────────────────────────────────
  if (tick % 60 === 0) {
    dynasty = pruneExpiredChallenges(dynasty, tick);

    if (isDynastyPressureActive(dynasty)) {
      emitDynastyPressure(bus, dynasty, tick);
    }
  }

  // ── Community heat refresh ─────────────────────────────────────────────────
  // Heat updates come from server; shouldRefreshHeat() signals when to request.
  // Actual update is applied via applyServerHeatUpdate() below.

  const leaderboard = getLegendsSortedByTier(decay);

  return {
    ghost,
    gap,
    decay,
    dynasty,
    heat,
    proof,
    activeLegend,
    legendBeatenThisRun,
    leaderboard,
  };
}

// ─── Public mutation helpers (called by server sync / lobby) ──────────────────

export function loadLegend(
  state: PhantomRunState,
  timeline: GhostTimeline,
  legend: LegendRecord,
  bus: EventBus,
): PhantomRunState {
  const ghost = loadGhostTimeline(state.ghost, timeline);

  emitGhostLoaded(bus, {
    tick:              0,
    legendId:          legend.legendId,
    legendDisplayName: legend.displayName,
    finalNetWorth:     legend.finalNetWorth,
    finalCordScore:    legend.finalCordScore,
    decayFactor:       legend.currentDecayFactor,
    previouslyBeaten:  legend.timesBeaten > 0,
  });

  return {
    ...state,
    ghost,
    gap:          INITIAL_GAP_STATE,
    activeLegend: legend,
    legendBeatenThisRun: false,
  };
}

export function applyServerHeatUpdate(
  state: PhantomRunState,
  activePlayers: number,
  dynastySpectators: number,
  currentTick: number,
): PhantomRunState {
  const heat = applyHeatUpdate(state.heat, activePlayers, dynastySpectators, currentTick);
  // Propagate heat multiplier to decay model
  const decay = setCommunityHeatMultiplier(state.decay, heat.heatMultiplier);
  return { ...state, heat, decay };
}

export function registerPlayerAsLegend(
  state: PhantomRunState,
  record: Parameters<typeof registerLegend>[1],
): PhantomRunState {
  const decay = registerLegend(state.decay, record);
  return { ...state, decay, leaderboard: getLegendsSortedByTier(decay) };
}

export function getCardModifiers(state: PhantomRunState, cardTags: string[]) {
  if (!state.activeLegend) return { effective: 1, blocked: false, label: '' };

  const ctx: PhantomCardContext = {
    ghost:   state.ghost,
    gap:     state.gap,
    legend:  state.activeLegend,
    dynasty: state.dynasty,
  };

  const modifiers = computePhantomCardModifiers(cardTags, ctx);
  return collapseModifiers(modifiers);
}

export function verifyBadge(state: PhantomRunState, badgeId: string): PhantomRunState {
  const proof = markBadgeVerified(state.proof, badgeId);
  return { ...state, proof };
}
