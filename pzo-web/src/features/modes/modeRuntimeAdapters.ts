import type { MarketRegime, IntelligenceState } from '../../components/GameBoard';
import type {
  AidContractRecord,
  DivergencePoint,
  GameModeState,
  RunMode,
} from '../../engines/core/types';
import type { PressureTier } from '../../engines/zero/types';
import type { RunGrade, SovereigntyScoreComponents } from '../../engines/sovereignty/types';

export interface RuntimeMetricInputs {
  pressureTier?: PressureTier | null;
  pressureScore?: number | null;
  tensionScore?: number | null;
  haterHeat?: number | null;
  shieldPct?: number | null;
  cashflow?: number | null;
  netWorth?: number | null;
  sovereigntyScore?: number | null;
  integrityVerified?: boolean;
  activeChains?: number | null;
  activeDecisionWindows?: number | null;
}

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function deriveMarketRegime({
  pressureTier,
  pressureScore = 0,
  tensionScore = 0,
  haterHeat = 0,
  shieldPct = 1,
  cashflow = 0,
  netWorth = 0,
}: RuntimeMetricInputs): MarketRegime {
  const normalizedHeat = haterHeat > 1 ? haterHeat / 100 : haterHeat;
  const stress = Math.max(
    pressureScore,
    tensionScore,
    normalizedHeat,
    1 - clamp01(shieldPct),
  );

  if (pressureTier === 'CRITICAL' || stress >= 0.86 || (cashflow < 0 && netWorth <= 0)) {
    return 'Panic';
  }

  if (pressureTier === 'HIGH' || stress >= 0.64) {
    return 'Compression';
  }

  if ((pressureTier === 'BUILDING' || pressureTier === 'ELEVATED') && cashflow >= 0) {
    return 'Expansion';
  }

  if (cashflow > 0 && netWorth > 0 && stress <= 0.18) {
    return 'Euphoria';
  }

  return 'Stable';
}

export function deriveIntelligenceState({
  pressureScore = 0,
  tensionScore = 0,
  shieldPct = 1,
  cashflow = 0,
  netWorth = 0,
  sovereigntyScore = 0,
  integrityVerified = true,
  activeChains = 0,
  activeDecisionWindows = 0,
  haterHeat = 0,
}: RuntimeMetricInputs): IntelligenceState {
  const heat = haterHeat > 1 ? haterHeat / 100 : haterHeat;
  const shield = clamp01(shieldPct);
  const incomeHealth = clamp01(cashflow >= 0 ? 0.6 + Math.min(0.4, cashflow / 20_000) : 0.45 + Math.max(-0.35, cashflow / 30_000));
  const sovereignty = normalizeCordScore(sovereigntyScore);
  const chaos = clamp01((pressureScore * 0.45) + (tensionScore * 0.35) + (heat * 0.20));

  return {
    alpha: clamp01((incomeHealth * 0.45) + (shield * 0.25) + (sovereignty * 0.30)),
    risk: clamp01((pressureScore * 0.45) + (tensionScore * 0.25) + ((1 - shield) * 0.20) + (activeChains * 0.04)),
    volatility: clamp01((tensionScore * 0.40) + (heat * 0.25) + (pressureScore * 0.20) + (activeDecisionWindows * 0.04)),
    antiCheat: clamp01((integrityVerified ? 0.85 : 0.45) + (sovereignty * 0.10)),
    personalization: clamp01(0.50 + (Math.min(0.25, activeDecisionWindows * 0.04)) + (Math.min(0.15, heat * 0.15))),
    rewardFit: clamp01((sovereignty * 0.55) + (incomeHealth * 0.20) + (shield * 0.25)),
    recommendationPower: clamp01((incomeHealth * 0.35) + (pressureScore * 0.10) + (sovereignty * 0.35) + (shield * 0.20)),
    churnRisk: clamp01((1 - incomeHealth) * 0.35 + pressureScore * 0.30 + tensionScore * 0.15 + (1 - shield) * 0.20),
    momentum: clamp01((incomeHealth * 0.40) + (Math.max(0, netWorth) > 0 ? 0.20 : 0) + (sovereignty * 0.25) + (shield * 0.15)),
  };
}

export function buildSyntheticEquityHistory({
  tick = 0,
  totalTicks = 720,
  netWorth = 0,
  cashflow = 0,
  pressureScore = 0,
  tensionScore = 0,
  shieldPct = 1,
  points = 24,
}: {
  tick?: number;
  totalTicks?: number;
  netWorth?: number;
  cashflow?: number;
  pressureScore?: number;
  tensionScore?: number;
  shieldPct?: number;
  points?: number;
}): number[] {
  const safePoints = Math.max(8, points);
  const progress = clamp01(totalTicks > 0 ? tick / totalTicks : 0);
  const amplitude = Math.max(600, Math.abs(netWorth) * (0.02 + (pressureScore * 0.03) + (tensionScore * 0.02)));
  const driftPerStep = (cashflow / 14) * (0.6 + progress * 0.8);

  return Array.from({ length: safePoints }, (_, index) => {
    const back = safePoints - index - 1;
    const wobble = Math.sin((tick / 9) + (index * 0.45)) * amplitude;
    const correction = Math.cos((tick / 13) + (index * 0.2)) * amplitude * 0.38;
    const stressPull = (1 - clamp01(shieldPct)) * amplitude * 0.55;
    const shaped = netWorth - (back * driftPerStep) - (wobble * 0.55) - (correction * 0.25) - stressPull;
    return Math.round(Math.max(-250_000, shaped));
  });
}

export function buildRuntimeEvents({
  mode,
  tick,
  pressureTier,
  activeBotsCount,
  activeNegativeChains,
  holdsRemaining,
  proofHash,
  grade,
  integrityStatus,
  rescueWindowOpen,
  ghostDelta,
}: {
  mode: RunMode;
  tick: number;
  pressureTier?: PressureTier | null;
  activeBotsCount?: number;
  activeNegativeChains?: number;
  holdsRemaining?: number;
  proofHash?: string | null;
  grade?: RunGrade | null;
  integrityStatus?: string | null;
  rescueWindowOpen?: boolean;
  ghostDelta?: number | null;
}): string[] {
  const events: string[] = [];

  events.push(`T${tick} · ${mode.toUpperCase()} runtime online`);

  if (pressureTier) {
    events.push(`PRESSURE · ${pressureTier}`);
  }

  if ((activeBotsCount ?? 0) > 0) {
    events.push(`BATTLE · ${activeBotsCount} hater bot${activeBotsCount === 1 ? '' : 's'} active`);
  }

  if ((activeNegativeChains ?? 0) > 0) {
    events.push(`CASCADE · ${activeNegativeChains} live chain${activeNegativeChains === 1 ? '' : 's'}`);
  }

  if (mode === 'solo') {
    events.push(`EMPIRE · ${holdsRemaining ?? 0} hold charge${holdsRemaining === 1 ? '' : 's'} remaining`);
  }

  if (mode === 'co-op' && rescueWindowOpen) {
    events.push('SYNDICATE · Rescue window opened');
  }

  if (mode === 'ghost' && ghostDelta !== null && ghostDelta !== undefined) {
    events.push(`PHANTOM · Gap ${ghostDelta >= 0 ? '+' : ''}${ghostDelta.toFixed(2)} vs legend`);
  }

  if (grade) {
    events.push(`CORD · Grade ${grade}`);
  }

  if (integrityStatus) {
    events.push(`PROOF · ${integrityStatus}`);
  }

  if (proofHash) {
    events.push(`HASH · ${proofHash.slice(0, 10)}…`);
  }

  return events.slice(-8);
}

export function normalizeCordScore(value: number | null | undefined): number {
  if (!Number.isFinite(value ?? NaN)) return 0;
  const score = Number(value);
  if (score <= 1.8) return Math.max(0, score);
  if (score <= 150) return score / 100;
  if (score <= 1500) return score / 1000;
  return clamp01(score / 1500) * 1.5;
}

export function countActiveShieldLayers(snapshot: { layers?: Array<{ current?: number | null }> } | null | undefined): number {
  const layers = snapshot?.layers ?? [];
  return layers.reduce((total, layer) => total + ((layer?.current ?? 0) > 0 ? 1 : 0), 0);
}

export function deriveFreezeTicks(activeDecisionWindows: Array<{ isOnHold?: boolean | null }> | null | undefined): number {
  if (!activeDecisionWindows?.length) return 0;
  return activeDecisionWindows.reduce((total, window) => total + (window?.isOnHold ? 1 : 0), 0);
}

export function buildSyndicateModeState(input: {
  partnerIncome: number;
  partnerNetWorth: number;
  partnerShieldPct: number;
  partnerInDistress: boolean;
  rescueWindowOpen: boolean;
  rescueWindowTicksLeft: number;
  activeAidContracts?: AidContractRecord[];
  synergyBonus: number;
  combinedNetWorth: number;
}): NonNullable<GameModeState['syndicate']> {
  return {
    partnerCash: Math.max(0, Math.round(input.partnerNetWorth * 0.12)),
    partnerIncome: input.partnerIncome,
    partnerNetWorth: input.partnerNetWorth,
    partnerShieldPct: input.partnerShieldPct,
    partnerInDistress: input.partnerInDistress,
    rescueWindowOpen: input.rescueWindowOpen,
    rescueWindowTicksLeft: input.rescueWindowTicksLeft,
    activeAidContracts: input.activeAidContracts ?? [],
    synergyBonus: input.synergyBonus,
    combinedNetWorth: input.combinedNetWorth,
  };
}

export function buildPhantomModeState(input: {
  ghostNetWorth: number;
  localNetWorth: number;
  delta: number;
  deltaPct: number;
  ghostIsAlive: boolean;
  ghostWonAt: number | null;
  proofBadgeEarned: boolean;
  divergencePoints: DivergencePoint[];
  championGrade: RunGrade;
}): NonNullable<GameModeState['phantom']> {
  return {
    ghostNetWorth: input.ghostNetWorth,
    localNetWorth: input.localNetWorth,
    delta: input.delta,
    deltaPct: input.deltaPct,
    ghostIsAlive: input.ghostIsAlive,
    ghostWonAt: input.ghostWonAt,
    proofBadgeEarned: input.proofBadgeEarned,
    divergencePoints: input.divergencePoints,
    championGrade: input.championGrade,
  };
}

export function buildCordComponentBreakdown(
  components: SovereigntyScoreComponents | null | undefined,
): Array<{ label: string; playerScore: number; ghostScore: number; weight: number }> {
  const source = components ?? {
    ticksSurvivedPct: 0,
    shieldsMaintainedPct: 0,
    haterBlockRate: 0,
    decisionSpeedScore: 0,
    cascadeBreakRate: 0,
  };

  const baseline = (value: number, delta: number) => clamp01(value - delta);

  return [
    {
      label: 'Ticks Survived',
      playerScore: source.ticksSurvivedPct,
      ghostScore: baseline(source.ticksSurvivedPct, 0.05),
      weight: 0.20,
    },
    {
      label: 'Shield Integrity',
      playerScore: source.shieldsMaintainedPct,
      ghostScore: baseline(source.shieldsMaintainedPct, 0.08),
      weight: 0.25,
    },
    {
      label: 'Hater Blocks',
      playerScore: source.haterBlockRate,
      ghostScore: baseline(source.haterBlockRate, 0.04),
      weight: 0.20,
    },
    {
      label: 'Decision Speed',
      playerScore: source.decisionSpeedScore,
      ghostScore: baseline(source.decisionSpeedScore, 0.03),
      weight: 0.15,
    },
    {
      label: 'Cascade Breaks',
      playerScore: source.cascadeBreakRate,
      ghostScore: baseline(source.cascadeBreakRate, 0.05),
      weight: 0.20,
    },
  ];
}

export function buildLegendMarkers({
  totalTicks,
  divergencePoints,
}: {
  totalTicks: number;
  divergencePoints?: DivergencePoint[];
}): Array<{ tick: number; type: 'OPPORTUNITY_TAKEN' | 'OPPORTUNITY_PASSED' | 'HOLD_ACTION' | 'SHIELD_BREACH' | 'CLUTCH_DECISION'; tickPct: number }> {
  if (divergencePoints?.length) {
    return divergencePoints.slice(0, 8).map((point, index) => ({
      tick: point.tick,
      tickPct: clamp01(totalTicks > 0 ? point.tick / totalTicks : 0),
      type: point.label.toLowerCase().includes('breach')
        ? 'SHIELD_BREACH'
        : point.label.toLowerCase().includes('hold')
          ? 'HOLD_ACTION'
          : point.impactScore >= 75
            ? 'CLUTCH_DECISION'
            : index % 2 === 0
              ? 'OPPORTUNITY_TAKEN'
              : 'OPPORTUNITY_PASSED',
    }));
  }

  const standardTicks = [0.16, 0.34, 0.5, 0.72, 0.9];
  const types: Array<'OPPORTUNITY_TAKEN' | 'OPPORTUNITY_PASSED' | 'HOLD_ACTION' | 'SHIELD_BREACH' | 'CLUTCH_DECISION'> = [
    'OPPORTUNITY_TAKEN',
    'OPPORTUNITY_PASSED',
    'HOLD_ACTION',
    'SHIELD_BREACH',
    'CLUTCH_DECISION',
  ];

  return standardTicks.map((pct, index) => ({
    tick: Math.round(totalTicks * pct),
    tickPct: pct,
    type: types[index],
  }));
}
