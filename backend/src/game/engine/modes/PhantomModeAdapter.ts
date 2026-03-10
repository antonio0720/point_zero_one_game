/*
 * POINT ZERO ONE — PHANTOM / CHASE A LEGEND MODE ADAPTER
 * /backend/src/game/engine/modes/PhantomModeAdapter.ts
 *
 * Doctrine:
 * - ghost mode is a contest against a verified historical run
 * - community heat must make ancient records harder
 * - legend markers create intelligence windows, not direct copies
 * - breaking a legend must be badge-worthy and score-relevant
 */

import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import type {
  ModeActionId,
  ModeAdapter,
  ModeConfigureOptions,
} from './ModeContracts';

const GHOST_WINDOW_RADIUS = 3;

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function removeTagsByPrefix(tags: readonly string[], prefix: string): string[] {
  return tags.filter((tag) => !tag.startsWith(prefix));
}

function upsertNumericTag(
  tags: readonly string[],
  prefix: string,
  value: number,
): string[] {
  return [...removeTagsByPrefix(tags, `${prefix}:`), `${prefix}:${value}`];
}

function readNumericTag(
  tags: readonly string[],
  prefix: string,
): number | null {
  const entry = tags.find((tag) => tag.startsWith(`${prefix}:`));
  if (!entry) {
    return null;
  }
  const value = Number(entry.slice(prefix.length + 1));
  return Number.isFinite(value) ? value : null;
}

function hasMarkerWindow(snapshot: RunStateSnapshot): boolean {
  return snapshot.cards.ghostMarkers.some(
    (marker) => Math.abs(marker.tick - snapshot.tick) <= GHOST_WINDOW_RADIUS,
  );
}

export class PhantomModeAdapter implements ModeAdapter {
  public readonly modeCode = 'ghost' as const;

  public configure(
    snapshot: RunStateSnapshot,
    options?: ModeConfigureOptions,
  ): RunStateSnapshot {
    const legendOriginalHeat = options?.legendOriginalHeat ?? snapshot.economy.haterHeat;
    const communityRunsSinceLegend = options?.communityRunsSinceLegend ?? 0;
    const communityHeatModifier = Number((communityRunsSinceLegend * 0.003).toFixed(3));
    const legendDaysAlive = options?.legendDaysAlive ?? 0;
    const legendDecayTax = Math.floor(legendDaysAlive / 3) * 5;
    const effectiveHeat = Math.round(legendOriginalHeat + communityHeatModifier + legendDecayTax);

    const legendCordScore = options?.legendCordScore ?? null;
    const gapVsLegend =
      legendCordScore === null
        ? snapshot.sovereignty.gapVsLegend
        : Number((snapshot.sovereignty.cordScore - legendCordScore).toFixed(6));

    return {
      ...snapshot,
      tags: uniqueStrings([
        ...snapshot.tags,
        'mode:phantom',
        'legend_markers:enabled',
        'hold:disabled',
        legendCordScore !== null ? `ghost:legend_cord:${legendCordScore}` : 'ghost:legend_cord:unknown',
      ]),
      economy: {
        ...snapshot.economy,
        haterHeat: Math.max(snapshot.economy.haterHeat, effectiveHeat),
      },
      cards: {
        ...snapshot.cards,
        ghostMarkers: options?.legendMarkers ?? snapshot.cards.ghostMarkers,
      },
      modeState: {
        ...snapshot.modeState,
        holdEnabled: false,
        loadoutEnabled: false,
        legendMarkersEnabled: true,
        communityHeatModifier,
        sharedOpportunityDeck: false,
        counterIntelTier: 0,
        spectatorLimit: 0,
        phaseBoundaryWindowsRemaining: 0,
        bleedMode: false,
        handicapIds: [],
        advantageId: null,
        disabledBots: [],
        modePresentation: 'phantom',
        roleLockEnabled: false,
        extractionActionsRemaining: 0,
        ghostBaselineRunId: options?.legendRunId ?? null,
        legendOwnerUserId: options?.legendOwnerUserId ?? null,
      },
      timers: {
        ...snapshot.timers,
        holdCharges: 0,
      },
      sovereignty: {
        ...snapshot.sovereignty,
        gapVsLegend,
        gapClosingRate: snapshot.sovereignty.gapClosingRate,
      },
      battle: {
        ...snapshot.battle,
        battleBudget: 0,
        battleBudgetCap: 0,
        extractionCooldownTicks: 0,
        rivalryHeatCarry: 0,
      },
    };
  }

  public onTickStart(snapshot: RunStateSnapshot): RunStateSnapshot {
    if (!hasMarkerWindow(snapshot)) {
      return {
        ...snapshot,
        tags: removeTagsByPrefix(snapshot.tags, 'ghost:marker_window'),
      };
    }

    return {
      ...snapshot,
      tags: uniqueStrings([...snapshot.tags, 'ghost:marker_window']),
      tension: {
        ...snapshot.tension,
        visibleThreats: snapshot.tension.visibleThreats.map((threat) => ({
          ...threat,
          visibleAs: 'EXPOSED',
        })),
      },
    };
  }

  public onTickEnd(snapshot: RunStateSnapshot): RunStateSnapshot {
    let next = snapshot;

    const communityHeatFloor = Math.max(
      snapshot.economy.haterHeat,
      Math.round(snapshot.modeState.communityHeatModifier),
    );

    next = {
      ...next,
      economy: {
        ...next.economy,
        haterHeat: communityHeatFloor,
      },
    };

    const nearMarker = hasMarkerWindow(next);
    const rateDelta =
      nearMarker && (next.pressure.tier === 'T0' || next.pressure.tier === 'T1' || next.pressure.tier === 'T2')
        ? 0.02
        : nearMarker
        ? 0.01
        : -0.005;

    next = {
      ...next,
      sovereignty: {
        ...next.sovereignty,
        gapClosingRate: Number((next.sovereignty.gapClosingRate + rateDelta).toFixed(6)),
        gapVsLegend: Number((next.sovereignty.gapVsLegend + rateDelta).toFixed(6)),
      },
    };

    return next;
  }

  public resolveAction(
    snapshot: RunStateSnapshot,
    actionId: ModeActionId,
    _payload?: Readonly<Record<string, unknown>>,
  ): RunStateSnapshot {
    if (actionId !== 'LOCK_GHOST_WINDOW' || !hasMarkerWindow(snapshot)) {
      return snapshot;
    }

    return {
      ...snapshot,
      tags: uniqueStrings([...snapshot.tags, 'ghost:window_locked']),
      modeState: {
        ...snapshot.modeState,
        phaseBoundaryWindowsRemaining: Math.max(
          snapshot.modeState.phaseBoundaryWindowsRemaining,
          1,
        ),
      },
      sovereignty: {
        ...snapshot.sovereignty,
        gapClosingRate: Number((snapshot.sovereignty.gapClosingRate + 0.025).toFixed(6)),
      },
      economy: {
        ...snapshot.economy,
        haterHeat: Math.max(0, snapshot.economy.haterHeat - 3),
      },
    };
  }

  public finalize(snapshot: RunStateSnapshot): RunStateSnapshot {
    let multiplier = 1;
    const badges = new Set(snapshot.sovereignty.proofBadges);

    multiplier += Math.min(0.35, snapshot.modeState.communityHeatModifier / 100);

    if (snapshot.outcome === 'FREEDOM' && snapshot.sovereignty.gapVsLegend > 0) {
      multiplier += 0.20;
      badges.add('LEGEND_BROKEN');
    } else if (snapshot.sovereignty.gapVsLegend >= -0.05) {
      multiplier += 0.10;
      badges.add('CHALLENGER');
    }

    if (snapshot.cards.ghostMarkers.length >= 20 && snapshot.outcome === 'FREEDOM') {
      multiplier += 0.05;
      badges.add('HISTORICAL_HUNTER');
    }

    return {
      ...snapshot,
      sovereignty: {
        ...snapshot.sovereignty,
        cordScore: Number((snapshot.sovereignty.cordScore * multiplier).toFixed(6)),
        proofBadges: [...badges],
      },
    };
  }
}