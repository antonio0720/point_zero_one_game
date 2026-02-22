import React from 'react';
import { useM89 } from './useM089';

interface Props {
  className?: string;
}

const M089: React.FC<Props> = ({ className }) => {
  const { mlEnabled, trustWeightedCosmeticMultipliers, auditHash } = useM089();

  if (!mlEnabled) return null;

  return (
    <div className={className}>
      <h2>Trust-Weighted Cosmetic Multipliers</h2>
      <p>
        Your integrity has earned you the following cosmetic multipliers:
      </p>
      {trustWeightedCosmeticMultipliers.map((multiplier, index) => (
        <div key={index} className="cosmetic-multiplier">
          <span>{multiplier.name}</span>
          <span>Multiplier: {multiplier.multiplier.toFixed(2)}</span>
        </div>
      ))}
      <p>Audit Hash: {auditHash}</p>
    </div>
  );
};

export default M089;
