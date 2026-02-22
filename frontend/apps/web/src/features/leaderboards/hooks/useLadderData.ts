/**
 * Hook for fetching and caching ladder data with polling, respecting verified batch windows to avoid flicker.
 */

import { useEffect, useState } from 'react';
import axios from 'axios';

type LadderData = {
  /** Unique identifier of the ladder */
  id: number;
  /** Name of the ladder */
  name: string;
  /** Array of player scores in the ladder, sorted by score */
  players: {
    /** Unique identifier of the player */
    id: number;
    /** Player's score */
    score: number;
  }[];
};

/**
 * Fetches and caches ladder data with polling, respecting verified batch windows to avoid flicker.
 *
 * @param {number} ladderId - The unique identifier of the ladder to fetch data for.
 * @returns {LadderData | null} The current ladder data or null if an error occurred.
 */
export function useLadderData(ladderId: number): LadderData | null {
  const [data, setData] = useState<LadderData | null>(null);
  const [lastVerifiedBatch, setLastVerifiedBatch] = useState<number | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get(`/api/leaderboards/${ladderId}`);
        const { data: fetchedData, headers } = response;

        // Check if the batch has been verified and is within the allowed window
        const currentBatch = parseInt(headers['x-batch']);
        if (lastVerifiedBatch && Math.abs(currentBatch - lastVerifiedBatch) > 10) {
          return;
        }

        setData(fetchedData);
        setLastVerifiedBatch(currentBatch);
      } catch (error) {
        console.error('Error fetching ladder data:', error);
        setData(null);
      }
    };

    // Initial fetch and polling interval
    fetchData();
    const pollingInterval = setInterval(fetchData, 5000);

    // Cleanup on unmount
    return () => {
      clearInterval(pollingInterval);
    };
  }, [ladderId, lastVerifiedBatch]);

  return data;
}
