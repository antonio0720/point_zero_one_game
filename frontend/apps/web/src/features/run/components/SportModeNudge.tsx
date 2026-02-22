/**
 * SportModeNudge component for Point Zero One Digital's financial roguelike game.
 */

import React from 'react';

type Props = {
  /** Callback function to handle user clicking the nudge */
  onNudgeClick: () => void;
};

/**
 * Non-blocking nudge UI component for unlocking Sport Mode.
 */
const SportModeNudge: React.FC<Props> = ({ onNudgeClick }) => {
  return (
    <div className="sport-mode-nudge">
      <h2>Unlock Sport Mode</h2>
      <p>Prove runs, earn prestige.</p>
      <button onClick={onNudgeClick}>Show me how!</button>
    </div>
  );
};

export { SportModeNudge };
