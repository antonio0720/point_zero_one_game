/**
 * ReplayToTurningPointButton component for deep-linking to pivotal turn anchor.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { TurningPointAnchorContext } from '../../contexts/TurningPointAnchorContext';

/**
 * ReplayToTurningPointButton component.
 */
export const ReplayToTurningPointButton: React.FC = () => {
  const { turningPointAnchor } = React.useContext(TurningPointAnchorContext);

  return (
    <Link to={turningPointAnchor} className="replay-to-turning-point-button">
      Replay from Turning Point
    </Link>
  );
};
