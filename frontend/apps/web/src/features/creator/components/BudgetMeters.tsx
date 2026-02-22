/**
 * BudgetMeters component for Point Zero One Digital's financial roguelike game.
 * Displays visual budget meters for complexity, volatility, reward, disruption, and mod-risk.
 * Each meter has a per-level envelope.
 */

import React from 'react';
import { Meter } from '../Meter';

type Props = {
  /** Level number */
  level: number;

  /** Complexity budget for the current level */
  complexityBudget: number;

  /** Current complexity value */
  complexityValue: number;

  /** Volatility budget for the current level */
  volatilityBudget: number;

  /** Current volatility value */
  volatilityValue: number;

  /** Reward budget for the current level */
  rewardBudget: number;

  /** Current reward value */
  rewardValue: number;

  /** Disruption budget for the current level */
  disruptionBudget: number;

  /** Current disruption value */
  disruptionValue: number;

  /** Mod-risk budget for the current level */
  modRiskBudget: number;

  /** Current mod-risk value */
  modRiskValue: number;
};

export const BudgetMeters = ({
  level,
  complexityBudget,
  complexityValue,
  volatilityBudget,
  volatilityValue,
  rewardBudget,
  rewardValue,
  disruptionBudget,
  disruptionValue,
  modRiskBudget,
  modRiskValue,
}: Props) => {
  return (
    <div>
      <Meter
        label="Complexity"
        budget={complexityBudget}
        value={complexityValue}
        level={level}
      />
      <Meter
        label="Volatility"
        budget={volatilityBudget}
        value={volatilityValue}
        level={level}
      />
      <Meter
        label="Reward"
        budget={rewardBudget}
        value={rewardValue}
        level={level}
      />
      <Meter
        label="Disruption"
        budget={disruptionBudget}
        value={disruptionValue}
        level={level}
      />
      <Meter
        label="Mod-Risk"
        budget={modRiskBudget}
        value={modRiskValue}
        level={level}
      />
    </div>
  );
};
