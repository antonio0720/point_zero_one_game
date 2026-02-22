/**
 * Hook for fetching creator profile, level, quotas, and budgets. Caches results and refreshes on pipeline events.
 */

import { useEffect, useState } from 'react';
import axios from 'axios';

type CreatorProfile = {
  id: number;
  name: string;
  level: number;
  quotas: {
    maxGames: number;
    maxPlayers: number;
  };
  budgets: {
    base: number;
    daily: number;
  };
};

const useCreatorProfile = () => {
  const [profile, setProfile] = useState<CreatorProfile | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get('/api/creator-profile');
        setProfile(response.data);
      } catch (error) {
        console.error('Error fetching creator profile:', error);
      }
    };

    fetchData();
  }, []); // Empty dependency array ensures the effect runs only on mount and unmount

  useEffect(() => {
    const pipelineEventSource = new EventSource('/api/pipeline-events');

    pipelineEventSource.onmessage = (event) => {
      if (event.data === 'creator_profile_updated') {
        fetchData();
      }
    };

    return () => pipelineEventSource.close();
  }, []); // Empty dependency array ensures the event listener is unsubscribed on unmount

  return profile;
};

export default useCreatorProfile;
