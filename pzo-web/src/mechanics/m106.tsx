import React from 'react';
import { M106AssetConditionSystem } from './M106AssetConditionSystem';

interface Props {
  assetId: string;
}

const M106ViralitySurface = ({ assetId }: Props) => {
  const mlEnabled = true; // TODO: replace with actual ML model status
  const wear = 0.5; // TODO: replace with actual wear value (bounded between 0 and 1)
  const maintenance = 0.2; // TODO: replace with actual maintenance value (bounded between 0 and 1)
  const failure = 0.3; // TODO: replace with actual failure value (bounded between 0 and 1)
  const auditHash = '1234567890abcdef'; // TODO: replace with actual audit hash

  return (
    <M106AssetConditionSystem
      assetId={assetId}
      wear={wear}
      maintenance={maintenance}
      failure={failure}
      mlEnabled={mlEnabled}
      auditHash={auditHash}
    />
  );
};

export default M106ViralitySurface;
