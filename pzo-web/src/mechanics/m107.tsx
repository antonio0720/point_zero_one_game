import React from 'react';
import { M107RefiLadder } from './M107RefiLadder';

interface Props {
  mlEnabled: boolean;
}

const M107ViralitySurface = ({ mlEnabled }: Props) => {
  const auditHash = Math.random().toString(36).substr(2, 10);

  if (!mlEnabled) return null;

  return (
    <div className="virality-surface">
      <M107RefiLadder />
      <p>audit hash: {auditHash}</p>
    </div>
  );
};

export default M107ViralitySurface;
