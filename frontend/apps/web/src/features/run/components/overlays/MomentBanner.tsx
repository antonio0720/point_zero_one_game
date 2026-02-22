/**
 * MomentBanner component for capturing and displaying story moments in Point Zero One Digital's financial roguelike game.
 */

import React, { useState } from 'react';
import { StoryMoment } from '../../types/StoryMoment';

type Props = {
  moment: StoryMoment | null;
};

const MomentBanner: React.FC<Props> = ({ moment }) => {
  const [isOpen, setIsOpen] = useState(!!moment);

  const handlePivot = () => {
    // Handle pivotal turn capture and update local context for share cards
    // ...
    setIsOpen(true);
  };

  return (
    <div className="moment-banner">
      {isOpen && (
        <>
          <h2>{moment?.title}</h2>
          <p>{moment?.description}</p>
        </>
      )}
      <button onClick={handlePivot}>View Moment</button>
    </div>
  );
};

export { MomentBanner };
