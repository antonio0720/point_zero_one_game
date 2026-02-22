import React from 'react';
import { useM22 } from './useM22';

interface M22Props {
  className?: string;
}

const M22: React.FC<M22Props> = ({ className }) => {
  const { mlEnabled, guarantee, auditHash } = useM22();

  if (!mlEnabled) return null;

  const boundedGuarantee = Math.min(Math.max(guarantee, 0), 1);

  return (
    <div className={className}>
      <h2>3-Moment Guarantee System (M22)</h2>
      <p>
        Your current guarantee is{' '}
        {boundedGuarantee.toFixed(4)} ({guarantee} before bounding)
      </p>
      <p>Audit Hash: {auditHash}</p>
    </div>
  );
};

export default M22;
