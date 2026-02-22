import React from 'react';
import { useGameContext } from '../game-context';
import { useMLModel } from '../ml-model';
import { ViralitySurfaceProps } from './virality-surface';

const M41_90SecondBootRunOnboardingSprint = () => {
  const gameContext = useGameContext();
  const mlModel = useMLModel();

  if (!gameContext || !mlModel) return null;

  const viralitySurfaceProps: ViralitySurfaceProps = {
    title: '90-Second Boot Run',
    description:
      'Get familiar with the game mechanics in this high-intensity sprint.',
    image: '/images/m41.png',
    mlEnabled: mlModel.enabled,
    auditHash: mlModel.auditHash,
  };

  return (
    <div className="virality-surface">
      <h2>{viralitySurfaceProps.title}</h2>
      <p>{viralitySurfaceProps.description}</p>
      <img src={viralitySurfaceProps.image} alt={viralitySurfaceProps.title} />
      {mlModel.enabled && (
        <div>
          <label>ML Model Enabled:</label>
          <input
            type="checkbox"
            checked={mlModel.enabled}
            onChange={() => mlModel.setEnabled(!mlModel.enabled)}
          />
        </div>
      )}
    </div>
  );
};

export default M41_90SecondBootRunOnboardingSprint;
