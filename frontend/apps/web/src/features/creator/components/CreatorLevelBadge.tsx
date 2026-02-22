/**
 * CreatorLevelBadge component for displaying the creator's level and associated perks.
 */

import React from 'react';

type Level = 'Apprentice' | 'CERTIFIED' | 'Season Partner';

interface Props {
  level: Level;
  unlockedPerks: string[];
}

const CreatorLevelBadge: React.FC<Props> = ({ level, unlockedPerks }) => {
  return (
    <div className="creator-level-badge">
      <div className={`level ${level}`}>{level}</div>
      <ul className="perks">
        {unlockedPerks.map((perk) => (
          <li key={perk}>{perk}</li>
        ))}
      </ul>
    </div>
  );
};

export default CreatorLevelBadge;
