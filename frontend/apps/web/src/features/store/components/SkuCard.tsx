/**
 * SKUCard component for displaying taxonomy tag, badges, and ranked-compat indicator.
 */

import React from 'react';
import { Sku } from '../../types/sku';

type Props = {
  sku: Sku;
};

const SKUCard: React.FC<Props> = ({ sku }) => {
  const { taxonomy, badges, rankedCompatibility } = sku;

  return (
    <div className="sku-card">
      <h3>{taxonomy}</h3>
      {badges.map((badge) => (
        <span key={badge} className={`badge badge-${badge}`}>
          {badge}
        </span>
      ))}
      {rankedCompatibility && (
        <div className="ranked-compat">Ranked Compatible</div>
      )}
    </div>
  );
};

export default SKUCard;
