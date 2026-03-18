import React, { memo, useMemo } from 'react';
import PhantomGameScreen, {
  type CordComponentScore,
  type GhostDelta,
  type GhostReplayEntry,
  type LegendMarker,
  type LegendRecord,
} from '../../components/PhantomGameScreen';
import type { GameModeState, RunGrade } from '../../engines/core/types';
import type { ZeroFacade } from '../../engines/zero/ZeroFacade';
import { useEngineStore } from '../../store/engineStore';
import { useRunStore } from '../../store/runStore';
import {
  buildCordComponentBreakdown,
  buildLegendMarkers,
  buildPhantomModeState,
  buildRuntimeEvents,
  buildSyntheticEquityHistory,
  countActiveShieldLayers,
  deriveFreezeTicks,
  deriveIntelligenceState,
  deriveMarketRegime,
  normalizeCordScore,
} from './modeRuntimeAdapters';

export interface PhantomModeContainerProps {
  facade?: ZeroFacade | null;
  chatEngine?: unknown;
  modeState?: GameModeState | null;
  legend?: LegendRecord;
  replayFeed?: GhostReplayEntry[];
  onGhostVisionExpand?: () => void;
}

export const PhantomModeContainer = memo(function PhantomModeContainer({
  modeState,
  legend,
  replayFeed,
  onGhostVisionExpand,
}: PhantomModeContainerProps) {
  const run = useEngineStore((state) => state.run);
  const time = useEngineStore((state) => state.time);
  const pressure = useEngineStore((state) => state.pressure);
  const tension = useEngineStore((state) => state.tension);
  const shield = useEngineStore((state) => state.shield);
  const battle = useEngineStore((state) => state.battle);
  const cascade = useEngineStore((state) => state.cascade);
  const sovereignty = useEngineStore((state) => state.sovereignty);

  const cash = useRunStore((state) => state.cashBalance ?? 0);
  const income = useRunStore((state) => state.monthlyIncome ?? 0);
  const expenses = useRunStore((state) => state.monthlyExpenses ?? 0);
  const netWorth = useRunStore((state) => state.netWorth ?? 0);

  const totalTicks = Math.max(1, time.seasonTickBudget || 720);
  const tick = Math.max(time.ticksElapsed ?? run.lastTickIndex ?? 0, 0);
  const shieldLayers = countActiveShieldLayers(shield.snapshot);
  const shieldPct = Math.max(0, Math.min(1, shield.overallIntegrityPct / 100));
  const cashflow = income - expenses;
  const activeChains = cascade.activeNegativeChains.length;
  const freezeTicks = deriveFreezeTicks(time.activeDecisionWindows);
  const playerCord = normalizeCordScore(sovereignty.sovereigntyScore);

  const ghostNetWorth = modeState?.phantom?.ghostNetWorth ?? Math.round(netWorth * (0.92 + (pressure.score * 0.08)) + 6500);
  const delta = modeState?.phantom?.delta ?? (netWorth - ghostNetWorth);
  const deltaPct = modeState?.phantom?.deltaPct ?? (ghostNetWorth !== 0 ? delta / Math.abs(ghostNetWorth) : 0);
  const championGrade: RunGrade = modeState?.phantom?.championGrade ?? (sovereignty.grade ?? 'A');
  const proofBadgeEarned = modeState?.phantom?.proofBadgeEarned ?? playerCord >= Math.max(1.05, playerCord + Math.min(0, deltaPct * 0.08));

  const resolvedModeState = useMemo<GameModeState>(() => ({
    mode: 'ghost',
    phantom: buildPhantomModeState({
      ghostNetWorth,
      localNetWorth: netWorth,
      delta,
      deltaPct,
      ghostIsAlive: modeState?.phantom?.ghostIsAlive ?? true,
      ghostWonAt: modeState?.phantom?.ghostWonAt ?? null,
      proofBadgeEarned,
      divergencePoints: modeState?.phantom?.divergencePoints ?? [
        {
          tick: Math.max(12, Math.round(totalTicks * 0.2)),
          label: 'Legend bought early scale line',
          localDeltaAfter: Math.round(delta * 0.35),
          impactScore: 62,
        },
        {
          tick: Math.max(18, Math.round(totalTicks * 0.5)),
          label: activeChains > 0 ? 'Shield breach exploit window' : 'Hold-action timing edge',
          localDeltaAfter: Math.round(delta * 0.75),
          impactScore: activeChains > 0 ? 81 : 74,
        },
      ],
      championGrade,
    }),
  }), [activeChains, championGrade, delta, deltaPct, ghostNetWorth, modeState?.phantom?.divergencePoints, modeState?.phantom?.ghostIsAlive, modeState?.phantom?.ghostWonAt, netWorth, proofBadgeEarned, totalTicks]);

  const regime = useMemo(
    () => deriveMarketRegime({
      pressureTier: pressure.tier,
      pressureScore: pressure.score,
      tensionScore: tension.score,
      haterHeat: battle.haterHeat,
      shieldPct,
      cashflow,
      netWorth,
    }),
    [battle.haterHeat, cashflow, netWorth, pressure.score, pressure.tier, shieldPct, tension.score],
  );

  const intelligence = useMemo(
    () => deriveIntelligenceState({
      pressureScore: pressure.score,
      tensionScore: tension.score,
      shieldPct,
      cashflow,
      netWorth,
      sovereigntyScore: playerCord,
      integrityVerified: sovereignty.integrityStatus !== 'TAMPERED',
      activeChains,
      activeDecisionWindows: time.activeDecisionWindows.length,
      haterHeat: battle.haterHeat,
    }),
    [activeChains, battle.haterHeat, cashflow, netWorth, playerCord, pressure.score, shieldPct, sovereignty.integrityStatus, tension.score, time.activeDecisionWindows.length],
  );

  const equityHistory = useMemo(
    () => buildSyntheticEquityHistory({
      tick,
      totalTicks,
      netWorth,
      cashflow,
      pressureScore: pressure.score,
      tensionScore: tension.score,
      shieldPct,
      points: 32,
    }),
    [cashflow, netWorth, pressure.score, shieldPct, tension.score, tick, totalTicks],
  );

  const resolvedLegend = useMemo<LegendRecord>(() => {
    if (legend) return legend;

    return {
      id: 'legend-current-season',
      displayName: 'The Legend',
      grade: championGrade,
      cordScore: Math.max(0.85, playerCord + Math.max(0.04, Math.abs(deltaPct) * 0.12)),
      finalNetWorth: ghostNetWorth,
      decayLevel: Math.max(0, Math.min(6, activeChains)),
      communityRunsSince: Math.max(0, time.ticksElapsed ?? 0),
      effectiveHeatModifier: Math.round((battle.haterHeat > 1 ? battle.haterHeat : battle.haterHeat * 100)),
      isChallengerSlot: false,
      beatRate: 0.08,
      challengeCount: Math.max(3, tick),
      survivorScore: Math.max(40, Math.round((shieldPct * 55) + (playerCord * 20))),
      seasonLabel: 'Season Sovereign',
      proofHash: sovereignty.proofHash ?? 'ghost-proof-pending',
    };
  }, [activeChains, battle.haterHeat, championGrade, deltaPct, ghostNetWorth, legend, playerCord, shieldPct, sovereignty.proofHash, tick, time.ticksElapsed]);

  const ghostDelta = useMemo<GhostDelta>(() => ({
    cordGap: playerCord - resolvedLegend.cordScore,
    netWorthGap: delta,
    cordGapPct: resolvedLegend.cordScore > 0 ? (playerCord - resolvedLegend.cordScore) / resolvedLegend.cordScore : 0,
    isAhead: playerCord >= resolvedLegend.cordScore,
    gapZone:
      playerCord >= resolvedLegend.cordScore + 0.08
        ? 'GAINING'
        : playerCord >= resolvedLegend.cordScore - 0.03
          ? 'NEUTRAL'
          : playerCord <= resolvedLegend.cordScore - 0.18
            ? 'CRITICAL'
            : 'LOSING',
    closingRate:
      delta >= 0
        ? 'GAINING'
        : Math.abs(deltaPct) < 0.08
          ? 'NEUTRAL'
          : 'WIDENING',
    drivingComponent:
      activeChains > 0
        ? `Cascade pressure ${activeChains}x`
        : pressure.tier === 'CRITICAL'
          ? 'Decision speed under T4'
          : 'Legend marker timing edge',
    closeableWindow: Math.max(0, totalTicks - tick),
    pressureIntensity: Math.max(pressure.score, tension.score),
  }), [activeChains, delta, deltaPct, playerCord, pressure.score, pressure.tier, resolvedLegend.cordScore, tension.score, tick, totalTicks]);

  const markers = useMemo<LegendMarker[]>(() => buildLegendMarkers({
    totalTicks,
    divergencePoints: resolvedModeState.phantom?.divergencePoints,
  }), [resolvedModeState.phantom?.divergencePoints, totalTicks]);

  const cordComponents = useMemo<CordComponentScore[]>(() =>
    buildCordComponentBreakdown(sovereignty.components).map((component) => ({
      ...component,
    })),
  [sovereignty.components]);

  const resolvedReplayFeed = useMemo<GhostReplayEntry[]>(() => {
    if (replayFeed?.length) return replayFeed;

    return buildRuntimeEvents({
      mode: 'ghost',
      tick,
      pressureTier: pressure.tier,
      activeBotsCount: battle.activeBotsCount,
      activeNegativeChains: activeChains,
      holdsRemaining: freezeTicks,
      proofHash: sovereignty.proofHash,
      grade: sovereignty.grade,
      integrityStatus: sovereignty.integrityStatus,
      ghostDelta: ghostDelta.cordGap,
    }).map((event, index) => ({
      tick: Math.max(0, tick - index * 3),
      cardType: event,
      zone: index % 2 === 0 ? 'Legend Track' : 'Divergence Lane',
      isRecent: index < 3,
    }));
  }, [activeChains, battle.activeBotsCount, freezeTicks, ghostDelta.cordGap, pressure.tier, replayFeed, sovereignty.grade, sovereignty.integrityStatus, sovereignty.proofHash, tick]);

  const dynastyChallengers = useMemo(() => {
    if (!proofBadgeEarned) return undefined;
    return [1, 2, 3].map((rank) => ({
      id: `challenger-${rank}`,
      displayName: `Challenger ${rank}`,
      cordScore: Math.max(0.7, resolvedLegend.cordScore - (rank * 0.06)),
      challengerRank: rank as 1 | 2 | 3,
    }));
  }, [proofBadgeEarned, resolvedLegend.cordScore]);

  const dynastyBeaten = useMemo(() => {
    if (!proofBadgeEarned) return undefined;
    const count = ghostDelta.isAhead ? Math.min(3, 1 + Math.floor(playerCord * 2)) : 0;
    return dynastyChallengers?.slice(0, count).map((challenger) => challenger.id);
  }, [dynastyChallengers, ghostDelta.isAhead, playerCord, proofBadgeEarned]);

  const proofBadgeType = ghostDelta.isAhead
    ? dynastyBeaten?.length === 3
      ? 'DYNASTY'
      : 'LEGEND'
    : undefined;

  return (
    <PhantomGameScreen
      cash={cash}
      netWorth={netWorth}
      income={income}
      expenses={expenses}
      regime={regime}
      intelligence={intelligence}
      tick={tick}
      totalTicks={totalTicks}
      freezeTicks={freezeTicks}
      shields={shieldLayers}
      equityHistory={equityHistory}
      legend={resolvedLegend}
      ghostDelta={ghostDelta}
      markers={markers}
      cordComponents={cordComponents}
      ghostVisionCardType={resolvedReplayFeed[0]?.cardType}
      ghostVisionTick={resolvedReplayFeed[0]?.tick}
      replayFeed={resolvedReplayFeed}
      dynastyChallengers={dynastyChallengers}
      dynastyBeaten={dynastyBeaten}
      playerCord={playerCord}
      wouldEarnProof={proofBadgeEarned || ghostDelta.isAhead}
      proofBadgeType={proofBadgeType}
      onGhostVisionExpand={onGhostVisionExpand}
    />
  );
});

export default PhantomModeContainer;
