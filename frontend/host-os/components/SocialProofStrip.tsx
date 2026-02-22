/**
 * SocialProofStrip component for displaying auto-scrolling ticker of moment code callouts as fake live clips.
 */

import React, { useState, useEffect } from 'react';
import moment from 'moment';

type Props = {
  /** Array of callout objects containing the location and timestamp */
  data: Callout[];
};

/**
 * Callout object structure for social proof ticker.
 */
type Callout = {
  /** Unique identifier for the callout */
  id: string;
  /** Location where the event occurred */
  location: string;
  /** Timestamp when the event occurred */
  timestamp: number;
};

/**
 * SocialProofStrip component.
 * @param {Props} props - Props object containing the callout data array.
 */
const SocialProofStrip: React.FC<Props> = ({ data }) => {
  const [callouts, setCallouts] = useState(data);
  const scrollInterval = 5000; // Scroll interval in milliseconds (5 seconds)

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    const scrollTick = () => {
      setCallouts((prevCallouts) => [
        ...prevCallouts.slice(1),
        { id: crypto.randomUUID(), location: 'Denver', timestamp: Date.now() },
      ]);
    };

    intervalId = setInterval(scrollTick, scrollInterval);

    return () => clearInterval(intervalId);
  }, []);

  return (
    <div className="social-proof-strip">
      {callouts.map((callout) => (
        <div key={callout.id} className="social-proof-item">
          HOS-{callout.id} fired {moment(callout.timestamp).fromNow()} in {callout.location}
        </div>
      ))}
    </div>
  );
};

export default SocialProofStrip;
