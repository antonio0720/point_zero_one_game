/**
 * ClipCountBadge component for displaying the number of clips captured for a night.
 * The badge color changes based on the number of clips captured.
 */

import React, { useState } from 'react';

type Props = {
  /** Number of clips captured for the current night */
  clipCount: number;
};

const ClipCountBadge: React.FC<Props> = ({ clipCount }) => {
  const [isAnimating, setIsAnimating] = useState(false);

  const handleClipCapture = () => {
    setIsAnimating(true);
    // Handle clip capture logic here
    setTimeout(() => {
      setIsAnimating(false);
    }, 500);
  };

  let colorClass = 'bg-gray-200';

  if (clipCount >= 3 && clipCount <= 10) {
    colorClass = 'bg-green-500';
  } else if (clipCount < 3) {
    colorClass = 'bg-red-500';
  } else if (clipCount > 10) {
    colorClass = 'bg-yellow-500';
  }

  return (
    <div className={`flex items-center justify-center w-6 h-6 rounded-full ${colorClass}`} onClick={handleClipCapture}>
      {clipCount > 0 && (
        <span className={`${isAnimating ? 'animate-ping' : ''} absolute inline-flex items-center justify-center w-full h-full text-white font-bold text-xs`}>{clipCount}</span>
      )}
    </div>
  );
};

export default ClipCountBadge;
