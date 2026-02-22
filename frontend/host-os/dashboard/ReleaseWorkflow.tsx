/**
 * Dashboard - Release Workflow Component
 */

import React, { useState } from 'react';
import { ProgressBar, Button } from '@material-ui/core';

type Step = {
  id: number;
  name: string;
  completed: boolean;
};

const steps: Step[] = [
  { id: 1, name: 'Select clips', completed: false },
  { id: 2, name: 'Write captions', completed: false },
  { id: 3, name: 'Pick thumbnails', completed: false },
  { id: 4, name: 'Schedule posts', completed: false },
  { id: 5, name: 'Pin comment', completed: false },
  { id: 6, name: 'Book next', completed: false },
  { id: 7, name: 'Send invite', completed: false },
];

const ReleaseWorkflow = () => {
  const [progress, setProgress] = useState(0);

  const handleStepComplete = (stepId: number) => {
    const newSteps = steps.map((step) =>
      step.id === stepId ? { ...step, completed: true } : step
    );
    setProgress((prevProgress) => Math.min(prevProgress + 1, steps.length));
    setSteps(newSteps);
  };

  return (
    <div>
      <h2>Post-night workflow checklist</h2>
      <ProgressBar value={progress} />
      {steps.map((step) => (
        <div key={step.id}>
          <h3>{step.name}</h3>
          {step.completed ? (
            <p>Completed</p>
          ) : (
            <Button onClick={() => handleStepComplete(step.id)}>
              Complete Step
            </Button>
          )}
        </div>
      ))}
    </div>
  );
};

export default ReleaseWorkflow;
