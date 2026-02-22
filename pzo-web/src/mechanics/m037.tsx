import React from 'react';
import { useGameContext } from '../game-context';
import { M37StreakBountiesHighRiskHighRewardUI } from './M37-streak-bounties-high-risk-high-reward-ui';

export const M037 = () => {
  const gameContext = useGameContext();

  if (!gameContext.mlEnabled) return null;

  const streakBounty = gameContext.streakBounty;
  const streakBountyReward = streakBounty.reward;
  const streakBountyRisk = streakBounty.risk;
  const streakBountyAuditHash = streakBounty.auditHash;

  if (streakBountyReward <= 0 || streakBountyRisk <= 0) return null;

  return (
    <M37StreakBountiesHighRiskHighRewardUI
      reward={streakBountyReward}
      risk={streakBountyRisk}
      auditHash={streakBountyAuditHash}
    />
  );
};
