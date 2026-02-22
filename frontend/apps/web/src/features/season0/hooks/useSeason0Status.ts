/**
 * Hook to fetch status and countdown, cache, auto-refresh near end date.
 */

import { useEffect, useState } from 'react';
import axios from 'axios';

type Season0Status = {
  current_season: number;
  remaining_days: number;
};

const useSeason0Status = (): [Season0Status, () => void] => {
  const [status, setStatus] = useState<Season0Status>({ current_season: -1, remaining_days: -1 });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get('/api/season0-status');
        setStatus(response.data);
      } catch (error) {
        console.error('Error fetching Season 0 status:', error);
      }
    };

    fetchData();

    // Auto-refresh near end date
    const refreshInterval = setInterval(() => {
      if (status.remaining_days <= 5) {
        clearInterval(refreshInterval);
        fetchData();
      }
    }, 60000);

    return () => clearInterval(refreshInterval);
  }, []);

  return [status, setStatus];
};

export default useSeason0Status;
