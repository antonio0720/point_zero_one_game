import React from 'react';
import { M104 } from '../../../engine/m104';

interface Props {
  m104: M104;
}

const DealScarcityIndexTheMarketGoesThin = ({ m104 }: Props) => {
  const mlEnabled = m104.mlEnabled;
  const dealScaicityIndex = m104.dealScaicityIndex;

  if (!mlEnabled) return null;

  const boundedDealScaicityIndex = Math.max(0, Math.min(dealScaicityIndex, 1));

  const auditHash = m104.auditHash;

  return (
    <div>
      <h2>Deal Scarcity Index (The Market Goes Thin)</h2>
      <p>
        The Deal Scarcity Index is a measure of the market's thinness. A higher
        value indicates that there are fewer deals available, making it harder to
        find good opportunities.
      </p>
      <p>Current Value: {boundedDealScaicityIndex.toFixed(2)}</p>
      <p>Audit Hash: {auditHash}</p>
    </div>
  );
};

export default DealScarcityIndexTheMarketGoesThin;
