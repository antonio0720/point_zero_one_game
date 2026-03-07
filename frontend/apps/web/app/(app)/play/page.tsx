'use client';

import { useState } from 'react';
import GoalTemplatePicker from './GoalTemplatePicker';
import ProfileTemplatePicker from './ProfileTemplatePicker';

export default function PlayPage() {
  const [selectedGoalTemplate, setSelectedGoalTemplate] = useState<string | null>(null);
  const [selectedProfileTemplate, setSelectedProfileTemplate] = useState<string | null>(null);

  const canStart = selectedGoalTemplate !== null && selectedProfileTemplate !== null;

  const handleStartRun = () => {
    console.log('Starting run with:', {
      goalTemplate: selectedGoalTemplate,
      profileTemplate: selectedProfileTemplate,
    });
  };

  return (
    <main style={{ padding: 24 }}>
      <h1>Play</h1>

      {selectedGoalTemplate === null ? (
        <GoalTemplatePicker onSelect={setSelectedGoalTemplate} />
      ) : (
        <p>
          Goal selected: <strong>{selectedGoalTemplate}</strong>
        </p>
      )}

      {selectedProfileTemplate === null ? (
        <ProfileTemplatePicker onSelect={setSelectedProfileTemplate} />
      ) : (
        <p>
          Profile selected: <strong>{selectedProfileTemplate}</strong>
        </p>
      )}

      <button
        type="button"
        onClick={handleStartRun}
        disabled={!canStart}
        style={{ marginTop: 16, padding: '10px 16px', cursor: canStart ? 'pointer' : 'not-allowed' }}
      >
        Start Run
      </button>
    </main>
  );
}