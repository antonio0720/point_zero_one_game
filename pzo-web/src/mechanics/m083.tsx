import React from 'react';
import { useM83 } from './useM83';

interface Props {
  className?: string;
}

const M083 = ({ className }: Props) => {
  const { mlEnabled, riskParityDialValue, optionalStabilityLeverUnderHeat } =
    useM083();

  if (!mlEnabled) return null;

  const boundedRiskParityDialValue = Math.max(0, Math.min(riskParityDialValue, 1));
  const boundedOptionalStabilityLeverUnderHeat =
    Math.max(0, Math.min(optionalStabilityLeverUnderHeat, 1));

  return (
    <div className={className}>
      <h2>Risk Parity Dial (Optional Stability Lever Under Heat)</h2>
      <p>
        Risk parity dial: {boundedRiskParityDialValue.toFixed(4)}
      </p>
      <p>
        Optional stability lever under heat: {boundedOptionalStabilityLeverUnderHeat.toFixed(4)}
      </p>
    </div>
  );
};

export default M083;
