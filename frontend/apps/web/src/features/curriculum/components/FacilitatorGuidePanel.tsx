/**
 * FacilitatorGuidePanel component for Point Zero One Digital's financial roguelike game.
 */

import React from 'react';

type Scenario = {
  id: number;
  name: string;
  description: string;
  debriefPrompts: string[];
};

interface Props {
  scenario: Scenario;
}

const FacilitatorGuidePanel: React.FC<Props> = ({ scenario }) => (
  <div>
    <h1>{scenario.name}</h1>
    <p>{scenario.description}</p>
    {scenario.debriefPrompts.map((prompt, index) => (
      <p key={index}>{prompt}</p>
    ))}
  </div>
);

export default FacilitatorGuidePanel;
