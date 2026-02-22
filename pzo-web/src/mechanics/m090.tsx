import React from 'react';
import { useM90 } from './useM90';
import { M90SalvageAndRerollSurfaceProps } from './types';

export const M90SalvageAndRerollSurface = ({
  auditHash,
}: M90SalvageAndRerollSurfaceProps) => {
  const { mlEnabled, salvageAndRerollProbability, salvageAndRerollReward } =
    useM90();

  if (!mlEnabled) return null;

  const boundedOutput = Math.min(Math.max(salvageAndRerollProbability, 0), 1);

  return (
    <div>
      <h2>Salvage and Reroll</h2>
      <p>
        Recycling achievements into new challenges is a key part of the M90
        experience. The probability of salvage and rerolling an achievement is{' '}
        {boundedOutput.toFixed(4)}.
      </p>
      <p>
        If you choose to salvage and reroll, you will receive a reward of{' '}
        {salvageAndRerollReward} points.
      </p>
    </div>
  );
};

export default M90SalvageAndRerollSurface;
