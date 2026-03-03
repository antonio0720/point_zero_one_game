/**
 * CounterfactualSimulator — src/ml/CounterfactualSimulator.ts
 * Point Zero One · Density6 LLC · Confidential
 *
 * Upgrade #11: "Three Alternate Timelines"
 *
 * Simulates 3 branch points from the actual run (same seed, altered choice)
 * and computes the delta on: final NW, CORD components, breach count.
 * Delivered as "You died because you missed THIS window."
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RunStateAtBranch {
  tick:          number;
  cash:          number;
  netWorth:      number;
  cashflow:      number;
  cordScore:     number;
  breachCount:   number;
  label:         string;   // what actually happened
}

export interface BranchScenario {
  branchTick:       number;
  actualChoice:     string;
  altChoice:        string;
  altOutcome: {
    deltaNetWorth:  number;
    deltaCord:      number;
    deltaBreaches:  number;
    finalCash:      number;
  };
  verdict:          string;    // "Would have survived" / "Would have closed +$42K gap"
  impactLevel:      'HIGH' | 'MEDIUM' | 'LOW';
}

export interface CounterfactualReport {
  branches:         BranchScenario[];
  biggestMissed:    BranchScenario;
  totalRecoverable: number;    // sum of CORD delta across all branches
  headline:         string;
}

// ─── Simulator ────────────────────────────────────────────────────────────────
// We use a deterministic forward simulation from a branch point.
// In production, plug in the full game engine's replay function.
// This approximation uses per-tick heuristics to project outcomes.

const MONTHLY_INCOME_PER_GOOD_PLAY = 800;
const NW_PER_GOOD_PLAY             = 12_000;
const CORD_PER_GOOD_PLAY           = 18;
const CORD_PER_MISSED_WINDOW       = -12;
const NW_PER_MISSED_WINDOW         = -5_000;

function simulateBranch(
  state:         RunStateAtBranch,
  altChoice:     string,
  ticksRemaining: number,
  isCorrectAlt:  boolean,
): BranchScenario['altOutcome'] {
  // If alt choice is correct: project positive trajectory
  // If alt choice is also wrong: project smaller negative
  const sign = isCorrectAlt ? 1 : -0.5;
  const ticks = Math.min(ticksRemaining, 240); // simulate next 240 ticks

  const deltaNetWorth = Math.round(sign * NW_PER_GOOD_PLAY * (ticks / 60));
  const deltaCord     = Math.round(sign * CORD_PER_GOOD_PLAY * (ticks / 60));
  const deltaBreaches = isCorrectAlt ? -1 : 0;
  const finalCash     = state.cash + Math.round(sign * MONTHLY_INCOME_PER_GOOD_PLAY * (ticks / 12));

  return { deltaNetWorth, deltaCord, deltaBreaches, finalCash };
}

export function computeCounterfactuals(
  branchStates:    RunStateAtBranch[],
  totalTicks:      number,
  finalCord:       number,
  finalNetWorth:   number,
): CounterfactualReport {
  if (branchStates.length === 0) {
    return {
      branches: [], biggestMissed: emptyBranch(),
      totalRecoverable: 0, headline: 'No branch points identified.',
    };
  }

  // Select top 3 most impactful branch points
  const top3 = branchStates
    .sort((a, b) => b.tick - a.tick)  // prefer later ticks (bigger impact)
    .slice(0, 3);

  const branches: BranchScenario[] = top3.map((state, i) => {
    const ticksRemaining = totalTicks - state.tick;
    const altChoices = ['Held cash instead', 'Played BUILD zone card', 'Activated shield mitigation'];
    const altChoice = altChoices[i] ?? 'Made optimal choice';
    const isCorrect = true; // alt is always the better path for counterfactual

    const altOutcome = simulateBranch(state, altChoice, ticksRemaining, isCorrect);

    const impactLevel: BranchScenario['impactLevel'] =
      Math.abs(altOutcome.deltaCord) > 50 ? 'HIGH' :
      Math.abs(altOutcome.deltaCord) > 20 ? 'MEDIUM' : 'LOW';

    const verdict = altOutcome.deltaCord > 30
      ? `Would have closed ${altOutcome.deltaCord} CORD gap — potentially decisive`
      : altOutcome.deltaNetWorth > 20_000
      ? `Would have added $${Math.round(altOutcome.deltaNetWorth / 1000)}K net worth`
      : `Minor improvement — reduced breach count by ${Math.abs(altOutcome.deltaBreaches)}`;

    return {
      branchTick:   state.tick,
      actualChoice: state.label,
      altChoice,
      altOutcome,
      verdict,
      impactLevel,
    };
  });

  const biggestMissed = branches.sort((a, b) =>
    Math.abs(b.altOutcome.deltaCord) - Math.abs(a.altOutcome.deltaCord),
  )[0];

  const totalRecoverable = branches.reduce((s, b) => s + Math.max(0, b.altOutcome.deltaCord), 0);

  const headline =
    biggestMissed.impactLevel === 'HIGH'
      ? `You lost ${biggestMissed.altOutcome.deltaCord} CORD at tick ${biggestMissed.branchTick}. That was the run.`
      : `No single decision was decisive. The gap accumulated gradually.`;

  return { branches, biggestMissed, totalRecoverable, headline };
}

function emptyBranch(): BranchScenario {
  return {
    branchTick: 0, actualChoice: 'N/A', altChoice: 'N/A',
    altOutcome: { deltaNetWorth: 0, deltaCord: 0, deltaBreaches: 0, finalCash: 0 },
    verdict: 'N/A', impactLevel: 'LOW',
  };
}