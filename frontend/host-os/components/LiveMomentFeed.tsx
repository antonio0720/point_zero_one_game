/**
 * LiveMomentFeed component for displaying real-time feed of fired moment codes with timestamps, tap to log, shows current clip count vs 3-10 target range.
 */

import React, { useState, useEffect } from 'react';
import MomentCode from './MomentCode';

type Moment = {
  id: number;
  code: string;
  timestamp: Date;
};

interface LiveMomentFeedProps {}

const LiveMomentFeed: React.FC<LiveMomentFeedProps> = () => {
  const [moments, setMoments] = useState<Moment[]>([]);
  const [currentClipCount, setCurrentClipCount] = useState(0);

  useEffect(() => {
    // Fetch live moments from the game engine or server here.
    // This is a placeholder and should be replaced with actual implementation.
    const mockMoments: Moment[] = [
      { id: 1, code: 'MOMENT_CODE_1', timestamp: new Date() },
      { id: 2, code: 'MOMENT_CODE_2', timestamp: new Date() },
      // Add more mock moments as needed.
    ];
    setMoments(mockMoments);
  }, []);

  const handleLogClick = (moment: Moment) => {
    // Handle log click event here. This is a placeholder and should be replaced with actual implementation.
    console.log(`Logged moment ${moment.code}`);
  };

  return (
    <div>
      <h2>Live Moment Feed</h2>
      <ul>
        {moments.map((moment) => (
          <li key={moment.id}>
            <MomentCode code={moment.code} timestamp={moment.timestamp} onClick={() => handleLogClick(moment)} />
          </li>
        ))}
      </ul>
      <p>Current clip count: {currentClipCount}</p>
      <p>Target range: 3-10</p>
    </div>
  );
};

export default LiveMomentFeed;
