import React, { memo, useMemo } from 'react';
import SyndicateGameScreen, {
  type RescueWindowState,
  type SyndicateGameScreenProps,
} from '../../components/SyndicateGameScreen';
import type { GameModeState } from '../../engines/core/types';
import type { ZeroFacade } from '../../engines/zero/ZeroFacade';
import { useEngineStore } from '../../store/engineStore';
import { useRunStore } from '../../store/runStore';
import {
  buildRuntimeEvents,
  buildSyntheticEquityHistory,
  buildSyndicateModeState,
  countActiveShieldLayers,
  deriveFreezeTicks,
  deriveIntelligenceState,
  deriveMarketRegime,
  normalizeCordScore,
} from './modeRuntimeAdapters';

export interface SyndicateModeContainerProps {
  facade?: ZeroFacade | null;
  chatEngine?: unknown;
  modeState?: GameModeState | null;
  rescueWindow?: RescueWindowState | null;
  allianceMembers?: SyndicateGameScreenProps['allianceMembers'];
  onAidSubmit?: SyndicateGameScreenProps['onAidSubmit'];
  onRescueContribute?: SyndicateGameScreenProps['onRescueContribute'];
  onRescueDismiss?: SyndicateGameScreenProps['onRescueDismiss'];
}

export const SyndicateModeContainer = memo(function SyndicateModeContainer({
  modeState,
  rescueWindow,
  allianceMembers,
  onAidSubmit,
  onRescueContribute,
  onRescueDismiss,
}: SyndicateModeContainerProps) {
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
  const userId = useRunStore((state) => state.userId);

  const totalTicks = Math.max(1, time.seasonTickBudget || 720);
  const tick = Math.max(time.ticksElapsed ?? run.lastTickIndex ?? 0, 0);
  const shieldLayers = countActiveShieldLayers(shield.snapshot);
  const shieldPct = Math.max(0, Math.min(1, shield.overallIntegrityPct / 100));
  const cashflow = income - expenses;
  const activeChains = cascade.activeNegativeChains.length;
  const holdCount = deriveFreezeTicks(time.activeDecisionWindows);
  const playerCord = normalizeCordScore(sovereignty.sovereigntyScore);
  const partnerIncome = (modeState?.syndicate?.partnerIncome ?? 0) || Math.max(1200, Math.round(income * 0.82));
  const partnerNetWorth = (modeState?.syndicate?.partnerNetWorth ?? 0) || Math.max(5000, Math.round(netWorth * 0.92));
  const partnerShieldPct = modeState?.syndicate?.partnerShieldPct ?? Math.max(0.28, Math.min(0.96, shieldPct * 0.94));
  const partnerInDistress =
    modeState?.syndicate?.partnerInDistress ??
    (partnerNetWorth < Math.max(12_000, netWorth * 0.55) || pressure.tier === 'CRITICAL');
  const synergyBonus =
    modeState?.syndicate?.synergyBonus ??
    Math.max(
      1,
      Math.min(
        2,
        1 + (Math.max(0, cashflow) / 30_000) + (shieldPct * 0.18) + (Math.max(0, 0.15 - (activeChains * 0.025))),
      ),
    );
  const combinedNetWorth = modeState?.syndicate?.combinedNetWorth ?? netWorth + partnerNetWorth;

  const resolvedModeState = useMemo<GameModeState>(() => ({
    mode: 'co-op',
    syndicate: buildSyndicateModeState({
      partnerIncome,
      partnerNetWorth,
      partnerShieldPct,
      partnerInDistress,
      rescueWindowOpen: modeState?.syndicate?.rescueWindowOpen ?? Boolean(rescueWindow) || pressure.tier === 'CRITICAL',
      rescueWindowTicksLeft:
        modeState?.syndicate?.rescueWindowTicksLeft ?? rescueWindow?.ticksRemaining ?? Math.max(0, 12 - activeChains),
      activeAidContracts: modeState?.syndicate?.activeAidContracts ?? [],
      synergyBonus,
      combinedNetWorth,
    }),
  }), [activeChains, combinedNetWorth, modeState?.syndicate?.activeAidContracts, modeState?.syndicate?.rescueWindowOpen, modeState?.syndicate?.rescueWindowTicksLeft, partnerIncome, partnerInDistress, partnerNetWorth, partnerShieldPct, pressure.tier, rescueWindow, synergyBonus]);

  const resolvedRescueWindow = useMemo<RescueWindowState | null>(() => {
    if (rescueWindow) return rescueWindow;
    if (!(resolvedModeState.syndicate?.rescueWindowOpen)) return null;

    return {
      rescueeDisplayName: 'Alliance Member',
      rescueeNetWorth: partnerNetWorth,
      ticksRemaining: resolvedModeState.syndicate?.rescueWindowTicksLeft ?? 0,
      allianceName: 'Syndicate Prime',
      contributionRequired: Math.max(2000, Math.round(Math.max(0, expenses - income) + 2500)),
      totalContributed: Math.max(0, Math.round(cash * 0.08)),
    };
  }, [cash, expenses, income, partnerNetWorth, rescueWindow, resolvedModeState.syndicate]);

  const resolvedAllianceMembers = useMemo<SyndicateGameScreenProps['allianceMembers']>(() => {
    if (allianceMembers?.length) return allianceMembers;

    return [
      {
        id: userId ?? 'local-operator',
        displayName: 'You',
        netWorth,
      },
      {
        id: 'partner-operator',
        displayName: 'Alliance Partner',
        netWorth: partnerNetWorth,
      },
    ];
  }, [allianceMembers, netWorth, partnerNetWorth, userId]);

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
      points: 30,
    }),
    [cashflow, netWorth, pressure.score, shieldPct, tension.score, tick, totalTicks],
  );

  const events = useMemo(
    () => buildRuntimeEvents({
      mode: 'co-op',
      tick,
      pressureTier: pressure.tier,
      activeBotsCount: battle.activeBotsCount,
      activeNegativeChains: activeChains,
      holdsRemaining: holdCount,
      proofHash: sovereignty.proofHash,
      grade: sovereignty.grade,
      integrityStatus: sovereignty.integrityStatus,
      rescueWindowOpen: Boolean(resolvedRescueWindow),
    }),
    [activeChains, battle.activeBotsCount, holdCount, pressure.tier, resolvedRescueWindow, sovereignty.grade, sovereignty.integrityStatus, sovereignty.proofHash, tick],
  );

  return (
    <SyndicateGameScreen
      cash={cash}
      income={income}
      expenses={expenses}
      netWorth={netWorth}
      shields={shieldLayers}
      shieldConsuming={shield.isInBreachCascade || battle.injectedCards.length > 0 || activeChains > 0}
      tick={tick}
      totalTicks={totalTicks}
      freezeTicks={holdCount}
      regime={regime}
      intelligence={intelligence}
      equityHistory={equityHistory}
      events={events}
      modeState={resolvedModeState}
      rescueWindow={resolvedRescueWindow}
      allianceMembers={resolvedAllianceMembers}
      onAidSubmit={onAidSubmit ?? (() => undefined)}
      onRescueContribute={onRescueContribute ?? (() => undefined)}
      onRescueDismiss={onRescueDismiss ?? (() => undefined)}
    />
  );
});

export default SyndicateModeContainer;
