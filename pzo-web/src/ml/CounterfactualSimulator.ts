/**
 * FILE: pzo-web/src/ml/CounterfactualSimulator.ts
 * Point Zero One · Density6 LLC · Confidential
 *
 * Upgrade #11: "Three Alternate Timelines"
 *
 * Purpose:
 * - Given a few “branch snapshots” from a run, simulate 3 alternate decisions.
 * - Output a tight report: deltas on Net Worth, CORD, breaches, and a headline.
 *
 * Constraints:
 * - Deterministic, pure, and self-contained (no engine dependency).
 * - Designed to be replaced later by real replay/forward-sim hooks.
 */

export interface RunStateAtBranch {
  tick: number;
  cash: number;
  netWorth: number;
  cashflow: number;
  cordScore: number;
  breachCount: number;
  label: string; // what actually happened (human-readable)
}

export type ImpactLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface BranchScenario {
  branchTick: number;
  actualChoice: string;
  altChoice: string;
  altOutcome: {
    deltaNetWorth: number;
    deltaCord: number;
    deltaBreaches: number;
    finalCash: number;
  };
  verdict: string;
  impactLevel: ImpactLevel;
}

export interface CounterfactualReport {
  branches: BranchScenario[];
  biggestMissed: BranchScenario;
  totalRecoverable: number; // sum of positive CORD deltas across all branches
  headline: string;
}

type SimParams = {
  // Tunables (deterministic constants)
  nwPerMinuteGood: number;
  cordPerMinuteGood: number;
  cashPerMinuteGood: number;

  nwPerMinuteBad: number;
  cordPerMinuteBad: number;
  cashPerMinuteBad: number;

  // How quickly breaches can be prevented by a “good” alternative
  breachRecoveryCap: number;
};

const DEFAULT_SIM: SimParams = {
  nwPerMinuteGood: 250, // +$250 NW per minute of “good play”
  cordPerMinuteGood: 0.35,
  cashPerMinuteGood: 18,

  nwPerMinuteBad: -110,
  cordPerMinuteBad: -0.18,
  cashPerMinuteBad: -8,

  breachRecoveryCap: 2,
};

function clampInt(n: number, min: number, max: number): number {
  const x = Number.isFinite(n) ? Math.trunc(n) : 0;
  return Math.max(min, Math.min(max, x));
}

function abs(n: number): number {
  return n < 0 ? -n : n;
}

function pickAltChoice(i: number, state: RunStateAtBranch): string {
  // Deterministic choice templates (no RNG).
  // Bias suggestions based on state to keep it “contextual” without dependency.
  const lowCash = state.cash < 500;
  const highBreaches = state.breachCount >= 2;
  const lowCord = state.cordScore < 40;

  const menu: string[] = [
    lowCash ? 'Preserved liquidity; deferred non-essential spend' : 'Held cash; avoided overextension',
    highBreaches ? 'Activated shield mitigation before breach cascade' : 'Preempted breach with mitigation window',
    lowCord ? 'Selected CORD-recovery line; executed the window cleanly' : 'Played BUILD zone card; stabilized fundamentals',
  ];

  return menu[i % menu.length] ?? 'Made optimal choice';
}

function impactLevelFromCord(deltaCord: number): ImpactLevel {
  const a = abs(deltaCord);
  if (a >= 40) return 'HIGH';
  if (a >= 18) return 'MEDIUM';
  return 'LOW';
}

function simulateBranchHeuristic(
  state: RunStateAtBranch,
  totalTicks: number,
  branchTick: number,
  improved: boolean,
  params: SimParams,
): BranchScenario['altOutcome'] {
  const ticksRemaining = Math.max(0, totalTicks - branchTick);

  // Convert ticks → minutes with a deterministic assumption.
  // If your engine uses different tick rate, replace here only.
  const minutes = ticksRemaining / 60;

  const nwRate = improved ? params.nwPerMinuteGood : params.nwPerMinuteBad;
  const cordRate = improved ? params.cordPerMinuteGood : params.cordPerMinuteBad;
  const cashRate = improved ? params.cashPerMinuteGood : params.cashPerMinuteBad;

  const deltaNetWorth = Math.round(nwRate * minutes);
  const deltaCord = Math.round(cordRate * minutes * 100) / 100; // 2dp stability
  const finalCash = Math.round(state.cash + cashRate * minutes);

  const deltaBreaches = improved
    ? -Math.min(params.breachRecoveryCap, Math.max(0, state.breachCount))
    : 0;

  return { deltaNetWorth, deltaCord, deltaBreaches, finalCash };
}

function emptyBranch(): BranchScenario {
  return {
    branchTick: 0,
    actualChoice: 'N/A',
    altChoice: 'N/A',
    altOutcome: { deltaNetWorth: 0, deltaCord: 0, deltaBreaches: 0, finalCash: 0 },
    verdict: 'N/A',
    impactLevel: 'LOW',
  };
}

function scoreBranchCandidate(state: RunStateAtBranch, totalTicks: number): number {
  // Higher score = more worth simulating.
  // Prefer earlier impactful mistakes (more runway) but also penalize heavy breach states.
  const runway = Math.max(0, totalTicks - state.tick);
  const runwayScore = runway / 60; // minutes remaining
  const breachScore = state.breachCount * 22;
  const cordPenalty = Math.max(0, 60 - state.cordScore) * 0.7;

  // Deterministic composite
  return runwayScore + breachScore + cordPenalty;
}

export function computeCounterfactuals(
  branchStates: RunStateAtBranch[],
  totalTicks: number,
  finalCord: number,
  finalNetWorth: number,
): CounterfactualReport {
  const cleanTotalTicks = Math.max(0, Math.trunc(totalTicks));

  const states = (branchStates ?? [])
    .filter((s) => s && Number.isFinite(s.tick))
    .map((s) => ({
      ...s,
      tick: clampInt(s.tick, 0, cleanTotalTicks),
      cash: Number.isFinite(s.cash) ? s.cash : 0,
      netWorth: Number.isFinite(s.netWorth) ? s.netWorth : 0,
      cashflow: Number.isFinite(s.cashflow) ? s.cashflow : 0,
      cordScore: Number.isFinite(s.cordScore) ? s.cordScore : 0,
      breachCount: clampInt(s.breachCount ?? 0, 0, 99),
      label: typeof s.label === 'string' ? s.label : 'Unknown choice',
    }));

  if (states.length === 0) {
    return {
      branches: [],
      biggestMissed: emptyBranch(),
      totalRecoverable: 0,
      headline: 'No branch points identified.',
    };
  }

  // Select top 3 by deterministic scoring.
  const top3 = [...states]
    .sort((a, b) => scoreBranchCandidate(b, cleanTotalTicks) - scoreBranchCandidate(a, cleanTotalTicks))
    .slice(0, 3);

  const branches: BranchScenario[] = top3.map((state, i) => {
    const altChoice = pickAltChoice(i, state);

    // By definition this is a “better” alt branch; keep deterministic.
    const altOutcome = simulateBranchHeuristic(state, cleanTotalTicks, state.tick, true, DEFAULT_SIM);

    const impactLevel = impactLevelFromCord(altOutcome.deltaCord);

    const verdict =
      impactLevel === 'HIGH'
        ? `Decisive: +${altOutcome.deltaCord} CORD, ${altOutcome.deltaBreaches} breaches, ΔNW $${altOutcome.deltaNetWorth}`
        : impactLevel === 'MEDIUM'
          ? `Meaningful: +${altOutcome.deltaCord} CORD, ΔNW $${altOutcome.deltaNetWorth}`
          : `Minor: +${altOutcome.deltaCord} CORD`;

    return {
      branchTick: state.tick,
      actualChoice: state.label,
      altChoice,
      altOutcome,
      verdict,
      impactLevel,
    };
  });

  const biggestMissed =
    branches
      .slice()
      .sort((a, b) => abs(b.altOutcome.deltaCord) - abs(a.altOutcome.deltaCord))[0] ?? emptyBranch();

  const totalRecoverable = branches.reduce((sum, b) => {
    const d = b.altOutcome.deltaCord;
    return sum + (d > 0 ? d : 0);
  }, 0);

  const cordGap = Math.max(0, Math.round((100 - (Number.isFinite(finalCord) ? finalCord : 0)) * 100) / 100);
  const nwGap = Math.max(0, Math.round((0 - (Number.isFinite(finalNetWorth) ? finalNetWorth : 0)) * 100) / 100);

  const headline =
    biggestMissed.impactLevel === 'HIGH'
      ? `Tick ${biggestMissed.branchTick}: biggest miss. +${biggestMissed.altOutcome.deltaCord} CORD was recoverable.`
      : totalRecoverable >= 25
        ? `No single decisive miss. ${totalRecoverable} CORD was recoverable across 3 windows.`
        : `Gap accumulated gradually (CORD gap ~${cordGap}).`;

  return {
    branches,
    biggestMissed,
    totalRecoverable,
    headline,
  };
}