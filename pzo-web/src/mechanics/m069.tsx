import React from 'react';
import { M69ChoiceDrills } from './M069ChoiceDrills';

interface Props {
  mlEnabled: boolean;
}

const M069 = ({ mlEnabled }: Props) => {
  const auditHash = Math.floor(Math.random() * (2 ** 32));
  const boundedOutput = mlEnabled ? Math.min(1, Math.max(0, 0.5 + (Math.random() - 0.5) * 0.5)) : 0;

  return (
    <M69ChoiceDrills
      auditHash={auditHash}
      boundedOutput={boundedOutput}
    />
  );
};

export default M069;
