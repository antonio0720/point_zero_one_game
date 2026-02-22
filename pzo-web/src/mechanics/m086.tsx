import React from 'react';
import { useM86MicroProofs } from './useM86MicroProofs';

interface Props {
  className?: string;
}

const M086 = ({ className }: Props) => {
  const { microProofs, auditHash, mlEnabled, isMLModelOutputBounded } = useM86MicroProofs();

  return (
    <div className={`m086 ${className}`}>
      <h2>Micro-Proofs (Moment-Scoped Achievement Stamps)</h2>
      <ul>
        {microProofs.map((proof) => (
          <li key={proof.id}>
            <span>{proof.name}</span>
            <span className="ml-enabled">{mlEnabled && proof.mlOutput}</span>
            <span className="audit-hash">Audit Hash: {auditHash[proof.id]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default M086;
