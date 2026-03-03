// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — game/modes/phantom/phantomEventBridge.ts
// Sprint 7 — Phantom EventBus Bridge (new)
//
// Registers PHANTOM channels on the core EventBus and provides typed
// emit helpers used by PhantomModeEngine.
//
// Pattern mirrors TensionEngine's channel registration in EventBus.ts:
//   1. Extend PZOEventChannel enum (in EventBus.ts) with PHANTOM_* entries
//   2. Register channels in registerEventChannels()
//   3. Call emitPhantom*() helpers from PhantomModeEngine tick loop
//
// NOTE: PZOEventChannel additions belong in EventBus.ts.
//       This file only provides the typed emit surface for Phantom.
//
// Density6 LLC · Confidential
// ═══════════════════════════════════════════════════════════════════════════

import type { EventBus } from '../../engines/core/EventBus';
import type { GhostState }            from './ghostReplayEngine';
import type { GapIndicatorState }     from './gapIndicatorEngine';
import type { LegendRecord }          from './legendDecayModel';
import type { DynastyChallengeStack } from './dynastyChallengeStack';
import type { ProofBadge }            from './phantomProofSystem';

// ── Channel strings (must match enum additions in EventBus.ts) ───────────────
// Add these to PZOEventChannel in EventBus.ts:
//   PHANTOM_GHOST_LOADED         = 'PHANTOM_GHOST_LOADED'
//   PHANTOM_GHOST_DELTA_UPDATE   = 'PHANTOM_GHOST_DELTA_UPDATE'
//   PHANTOM_GAP_ZONE_CHANGED     = 'PHANTOM_GAP_ZONE_CHANGED'
//   PHANTOM_NERVE_ELIGIBLE       = 'PHANTOM_NERVE_ELIGIBLE'
//   PHANTOM_AHEAD_OF_GHOST       = 'PHANTOM_AHEAD_OF_GHOST'
//   PHANTOM_BEHIND_GHOST         = 'PHANTOM_BEHIND_GHOST'
//   PHANTOM_LEGEND_BEATEN        = 'PHANTOM_LEGEND_BEATEN'
//   PHANTOM_DYNASTY_PRESSURE     = 'PHANTOM_DYNASTY_PRESSURE'
//   PHANTOM_PROOF_BADGE_EARNED   = 'PHANTOM_PROOF_BADGE_EARNED'

export const PHANTOM_CHANNELS = {
  GHOST_LOADED:       'PHANTOM_GHOST_LOADED',
  GHOST_DELTA_UPDATE: 'PHANTOM_GHOST_DELTA_UPDATE',
  GAP_ZONE_CHANGED:   'PHANTOM_GAP_ZONE_CHANGED',
  NERVE_ELIGIBLE:     'PHANTOM_NERVE_ELIGIBLE',
  AHEAD_OF_GHOST:     'PHANTOM_AHEAD_OF_GHOST',
  BEHIND_GHOST:       'PHANTOM_BEHIND_GHOST',
  LEGEND_BEATEN:      'PHANTOM_LEGEND_BEATEN',
  DYNASTY_PRESSURE:   'PHANTOM_DYNASTY_PRESSURE',
  PROOF_BADGE_EARNED: 'PHANTOM_PROOF_BADGE_EARNED',
} as const;

// ── Payloads ──────────────────────────────────────────────────────────────────

export interface PhantomGhostLoadedPayload {
  tick:              number;
  legendId:          string;
  legendDisplayName: string;
  finalNetWorth:     number;
  finalCordScore:    number;
  decayFactor:       number;
  previouslyBeaten:  boolean;
}

export interface PhantomGhostDeltaPayload {
  tick:              number;
  netWorthGap:       number;
  netWorthGapPct:    number;
  cordGap:           number;
  cordGapPct:        number;
  gapVelocity:       number;
  closeableWindow:   number | null;
  isAhead:           boolean;
  pressureIntensity: number;
}

export interface PhantomGapZoneChangedPayload {
  tick:    number;
  from:    string;
  to:      string;
  gapPct:  number;
}

export interface PhantomNerveEligiblePayload {
  tick:         number;
  intensityPct: number;
  streakTicks:  number;
}

export interface PhantomLegendBeatenPayload {
  tick:          number;
  legendId:      string;
  legendName:    string;
  finalGapPct:   number;
  proofHash:     string;
}

export interface PhantomDynastyPressurePayload {
  tick:       number;
  depth:      number;
  spectators: number;
}

export interface PhantomProofBadgePayload {
  tick:   number;
  badge:  ProofBadge;
}

// ── Typed emit helpers ────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyBus = Pick<EventBus, 'emit'>;

export function emitGhostLoaded(bus: AnyBus, payload: PhantomGhostLoadedPayload): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (bus.emit as any)(PHANTOM_CHANNELS.GHOST_LOADED, payload);
}

export function emitGhostDelta(bus: AnyBus, ghost: GhostState, tick: number): void {
  const payload: PhantomGhostDeltaPayload = {
    tick,
    netWorthGap:       ghost.netWorthGap,
    netWorthGapPct:    ghost.netWorthGapPct,
    cordGap:           ghost.cordGap,
    cordGapPct:        ghost.cordGapPct,
    gapVelocity:       ghost.gapVelocity,
    closeableWindow:   ghost.closeableWindow,
    isAhead:           ghost.isAhead,
    pressureIntensity: ghost.pressureIntensity,
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (bus.emit as any)(PHANTOM_CHANNELS.GHOST_DELTA_UPDATE, payload);
}

export function emitGapZoneChanged(
  bus: AnyBus,
  from: string,
  to: string,
  gapPct: number,
  tick: number,
): void {
  const payload: PhantomGapZoneChangedPayload = { tick, from, to, gapPct };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (bus.emit as any)(PHANTOM_CHANNELS.GAP_ZONE_CHANGED, payload);
}

export function emitNerveEligible(bus: AnyBus, gap: GapIndicatorState, tick: number): void {
  const payload: PhantomNerveEligiblePayload = {
    tick,
    intensityPct: gap.nerve.intensityPct,
    streakTicks:  gap.nerve.streakTicks,
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (bus.emit as any)(PHANTOM_CHANNELS.NERVE_ELIGIBLE, payload);
}

export function emitLegendBeaten(
  bus: AnyBus,
  legend: LegendRecord,
  finalGapPct: number,
  proofHash: string,
  tick: number,
): void {
  const payload: PhantomLegendBeatenPayload = {
    tick,
    legendId:    legend.legendId,
    legendName:  legend.displayName,
    finalGapPct,
    proofHash,
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (bus.emit as any)(PHANTOM_CHANNELS.LEGEND_BEATEN, payload);
}

export function emitDynastyPressure(
  bus: AnyBus,
  stack: DynastyChallengeStack,
  tick: number,
): void {
  const spectators = stack.entries
    .filter(e => e.outcome === 'IN_PROGRESS' || e.outcome === 'PENDING')
    .reduce((s, e) => s + e.spectatorCount, 0);

  const payload: PhantomDynastyPressurePayload = { tick, depth: stack.depth, spectators };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (bus.emit as any)(PHANTOM_CHANNELS.DYNASTY_PRESSURE, payload);
}

export function emitProofBadgeEarned(bus: AnyBus, badge: ProofBadge, tick: number): void {
  const payload: PhantomProofBadgePayload = { tick, badge };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (bus.emit as any)(PHANTOM_CHANNELS.PROOF_BADGE_EARNED, payload);
}
