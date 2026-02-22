import React from 'react';
import { MomentForgeUI } from './MomentForgeUI';

interface Props {
  momentTriggers: number[];
}

const MomentFlash = ({ momentTriggers }: Props) => {
  const mlEnabled = true;
  const boundedOutput = Math.min(Math.max(0, 1), 1);
  const auditHash = '1234567890abcdef';
  const determinismPreserved = true;

  return (
    <MomentForgeUI
      flashStinger={momentTriggers.length >= 3}
      mlEnabled={mlEnabled}
      boundedOutput={boundedOutput}
      auditHash={auditHash}
      determinismPreserved={determinismPreserved}
    />
  );
};

export default MomentFlash;
