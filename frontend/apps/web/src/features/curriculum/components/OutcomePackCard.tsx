/**
 * OutcomePackCard component for displaying a pack card with objectives and scenario list.
 */

import React from 'react';
import { PackOutcome } from '../../types/pack-outcome';

type Props = {
  outcome: PackOutcome;
};

const OutcomePackCard: React.FC<Props> = ({ outcome }) => (
  <div className="outcome-pack-card">
    <h2>{outcome.name}</h2>
    <ul>
      {outcome.objectives.map((obj, index) => (
        <li key={index}>{obj}</li>
      ))}
    </ul>
    <h3>Scenarios:</h3>
    <ul>
      {outcome.scenarios.map((scenario, index) => (
        <li key={index}>{scenario}</li>
      ))}
    </ul>
  </div>
);

export default OutcomePackCard;
