import React from 'react';
import { M115HeatSwapMoveRiskWithoutRemovingIt } from '../M115HeatSwapMoveRiskWithoutRemovingIt';

interface Props {
  mlEnabled?: boolean;
}

const ViralitySurfaceM115 = ({ mlEnabled }: Props) => {
  const auditHash = Math.floor(Math.random() * (2 ** 32));
  const boundedOutput = mlEnabled ? 0.5 : 1;

  return (
    <div className="virality-surface">
      <h2>Heat-Swap (Move Risk Without Removing It)</h2>
      <p>
        This mechanic allows players to move risk without removing it, creating a
        dynamic and unpredictable gameplay experience.
      </p>
      {mlEnabled && (
        <p>
          ML Model Output: {boundedOutput.toFixed(2)} ({auditHash})
        </p>
      )}
    </div>
  );
};

export default ViralitySurfaceM115;
