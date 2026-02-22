/**
 * RankedCompatibilityNotice component for Point Zero One Digital's financial roguelike game.
 * Displays a notice if a purchase is not compatible with ranked mode and routes to casual mode.
 */

import React from 'react';
import { Link } from 'react-router-dom';

type Props = {
  policyReasonCode: string;
};

const RankedCompatibilityNotice: React.FC<Props> = ({ policyReasonCode }) => (
  <div className="ranked-compatibility-notice">
    <h2>Your purchase is not compatible with ranked mode.</h2>
    <p>Please navigate to casual mode to continue playing.</p>
    <p>Policy reason code: {policyReasonCode}</p>
    <Link to="/casual">Go to casual mode</Link>
  </div>
);

export default RankedCompatibilityNotice;
