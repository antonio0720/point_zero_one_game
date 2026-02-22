import React from 'react';
import { M108 } from '../../../engine/m108';
import { ViralitySurfaceProps } from './virality-surface';

export const M108PartialFillsYouDontGetTheWholeDeal = ({
  ml_enabled,
  audit_hash,
}: ViralitySurfaceProps) => {
  if (!ml_enabled) return null;

  const partial_fill_probability = M108.partialFillProbability(audit_hash);

  return (
    <div className="virality-surface">
      <h2>Partial Fills (You Don't Get The Whole Deal)</h2>
      <p>
        In a Partial Fill, you don't get the whole deal. This can happen when
        your order is only partially filled.
      </p>
      <div className="probability-container">
        <span className="probability-label">Probability:</span>
        <span className="probability-value">{partial_fill_probability.toFixed(2)}</span>
      </div>
    </div>
  );
};

export default M108PartialFillsYouDontGetTheWholeDeal;
