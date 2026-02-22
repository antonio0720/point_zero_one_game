/**
 * PlayPage component for Point Zero One Digital's financial roguelike game.
 */

import React, { useState } from 'react';
import GoalTemplatePicker from './GoalTemplatePicker';
import ProfileTemplatePicker from './ProfileTemplatePicker';

type Props = {};

const PlayPage: React.FC<Props> = () => {
  const [selectedGoalTemplate, setSelectedGoalTemplate] = useState<string | null>(null);
  const [selectedProfileTemplate, setSelectedProfileTemplate] = useState<string | null>(null);

  const handleStartRun = () => {
    // Start the run with the selected goal and profile templates.
    // This function should be deterministic to ensure replayability.
  };

  return (
    <div>
      <h1>Play</h1>
      {selectedGoalTemplate === null && (
        <GoalTemplatePicker onSelect={setSelectedGoalTemplate} />
      )}
      {selectedProfileTemplate === null && (
        <ProfileTemplatePicker onSelect={setSelectedProfileTemplate} />
      )}
      {selectedGoalTemplate !== null && selectedProfileTemplate !== null && (
        <button onClick={handleStartRun}>Start Run</button>
      )}
    </div>
  );
};

export default PlayPage;
