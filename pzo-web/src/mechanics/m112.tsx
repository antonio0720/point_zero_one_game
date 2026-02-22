import React from 'react';
import { useGameContext } from '../game-context';
import { M112PrecisionSplitSellPartKeepPartUIProps } from './M112PrecisionSplitSellPartKeepPartUI.types';

const M112PrecisionSplitSellPartKeepPartUI = ({
  sellPart,
  keepPart,
}: M112PrecisionSplitSellPartKeepPartUIProps) => {
  const gameContext = useGameContext();

  if (!gameContext.mlEnabled) return null;

  const sellPartProbability = Math.min(Math.max(sellPart, 0), 1);
  const keepPartProbability = Math.min(Math.max(keepPart, 0), 1);

  const auditHash = crypto.createHash('sha256');
  auditHash.update(JSON.stringify({ sellPartProbability, keepPartProbability }));
  const auditHashValue = auditHash.digest('hex');

  return (
    <div className="virality-surface">
      <h2>Split Precision</h2>
      <p>
        Sell Part: {sellPartProbability.toFixed(4)} ({auditHashValue})
      </p>
      <p>
        Keep Part: {keepPartProbability.toFixed(4)} ({auditHashValue})
      </p>
    </div>
  );
};

export default M112PrecisionSplitSellPartKeepPartUI;
