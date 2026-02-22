/**
 * TrustBadge component for Point Zero One Digital's financial roguelike game.
 * Displays a badge indicating the trust level of an entity.
 */

import React from 'react';

type TrustLevel = 'low' | 'medium' | 'high';

interface TrustBadgeProps {
  /** The trust level of the entity represented by the badge */
  trustLevel: TrustLevel;
}

/**
 * Renders a trust badge component with the given trust level.
 *
 * @param props - The properties of the trust badge component.
 */
const TrustBadge: React.FC<TrustBadgeProps> = ({ trustLevel }) => {
  let className = 'trust-badge';

  switch (trustLevel) {
    case 'low':
      className += ' low';
      break;
    case 'medium':
      className += ' medium';
      break;
    case 'high':
      className += ' high';
      break;
    default:
      throw new Error(`Invalid trust level: ${trustLevel}`);
  }

  return <div className={className}></div>;
};

export { TrustBadge, TrustLevel };
