import React from 'react';
import { useGameContext } from '../context/GameContext';
import { useMLModel } from '../hooks/useMLModel';
import { AssetModSocketableMicroUpgradesUI } from './AssetModSocketableMicroUpgradesUI';

export const M34AssetModsSocketableMicroUpgrades = () => {
  const gameContext = useGameContext();
  const mlModel = useMLModel();

  if (!mlModel.enabled) return null;

  const output = mlModel.predict(gameContext.state);

  if (output === undefined || output < 0 || output > 1) {
    throw new Error('Invalid ML model output');
  }

  const auditHash = mlModel.auditHash;

  return (
    <AssetModSocketableMicroUpgradesUI
      enabled={mlModel.enabled}
      output={output}
      auditHash={auditHash}
    />
  );
};

export default M34AssetModsSocketableMicroUpgrades;
