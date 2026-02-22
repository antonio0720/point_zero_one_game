/**
 * DebriefCard component for displaying optional post-run debrief prompts in institution programs.
 */

import React from 'react';

type DebriefPrompt = {
  /** Unique identifier for the debrief prompt */
  id: string;
  /** Text content of the debrief prompt */
  text: string;
};

/** Props for the DebriefCard component */
interface DebriefCardProps {
  /** Array of debrief prompts to display, if any */
  prompts?: DebriefPrompt[];
}

/**
 * DebriefCard component
 *
 * Renders a container for optional post-run debrief prompts in institution programs.
 * If no prompts are provided, the component does not render anything.
 */
const DebriefCard: React.FC<DebrifCardProps> = ({ prompts }) => {
  if (!prompts || prompts.length === 0) {
    return null;
  }

  return (
    <div className="debrief-card">
      {prompts.map((prompt) => (
        <div key={prompt.id} className="debrief-prompt">
          {prompt.text}
        </div>
      ))}
    </div>
  );
};

export { DebriefCard, DebriefPrompt };
