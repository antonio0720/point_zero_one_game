/**
 * StreakPanel component for Season0 app in Point Zero One Digital's web frontend.
 * Displays streak meter, grace status, earned freezes remaining, and evolution preview.
 */

import React from 'react';

type StreakData = {
  /** Current streak count */
  streak: number;
  /** Grace period status (true for in-grace, false for out-of-grace) */
  grace: boolean;
  /** Number of earned freezes remaining */
  frozenFreezes: number;
};

type StreakPanelProps = {
  /** Data for the current streak */
  streakData: StreakData;
  /** Function to handle clicking on an evolution preview image */
  onEvolutionClick?: (evolutionId: number) => void;
};

/**
 * StreakPanel component for displaying streak data and evolution previews.
 * @param props - Props object containing the current streak data and a callback for handling evolution clicks.
 */
const StreakPanel: React.FC<StreakPanelProps> = ({ streakData, onEvolutionClick }) => {
  const { streak, grace, frozenFreezes } = streakData;

  return (
    <div className="streak-panel">
      <h2>Streak</h2>
      <div className="streak-meter">
        <div className="streak-bar" style={{ width: `${(streak / 100) * 100}%` }} />
      </div>
      <p>{grace ? 'In Grace' : 'Out of Grace'}</p>
      <h2>Freezes</h2>
      <p>{frozenFreezes}</p>
      <h2>Evolution Preview</h2>
      {onEvolutionClick && (
        <div className="evolution-previews">
          {/* Render evolution previews here */}
        </div>
      )}
    </div>
  );
};

export { StreakPanel, StreakData };
