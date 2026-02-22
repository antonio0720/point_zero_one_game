import React from 'react';
import { useGameContext } from '../context/GameContext';

interface Props {
  auditHash: string;
}

const ErosionMeter = ({ auditHash }: Props) => {
  const gameCtx = useGameContext();
  const mlEnabled = gameCtx.mlEnabled;

  if (!mlEnabled) return null;

  const erosionRate = Math.min(Math.max(gameCtx.cashDecay, 0), 1);
  const output = Math.floor(erosionRate * 100);

  return (
    <div className="hud-meter">
      <span className="hud-label">Cash Decay:</span>
      <progress
        value={output}
        max={100}
        className={`hud-progress ${gameCtx.cashDecay > 0.5 ? 'critical' : ''}`}
      />
      <span className="hud-value">{output}%</span>
    </div>
  );
};

export default ErosionMeter;
