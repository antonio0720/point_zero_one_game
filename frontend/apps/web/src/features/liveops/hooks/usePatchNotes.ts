/**
 * Hook for fetching and managing patch notes data.
 */

import { useEffect, useState } from 'react';
import axios from 'axios';

type PatchNote = {
  id: number;
  title: string;
  content: string;
  isVisible: boolean;
};

/**
 * Fetches and manages patch notes data.
 */
export function usePatchNotes(): [PatchNote[], (newNotes: PatchNote[]) => void] {
  const [notes, setNotes] = useState<PatchNote[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const response = await axios.get('/api/patch-notes');
      setNotes(response.data);
    };

    fetchData();
  }, []);

  /**
   * Updates the patch notes data with new notes.
   * @param newNotes - The new patch notes to be added.
   */
  const updatePatchNotes = (newNotes: PatchNote[]): void => {
    setNotes((prevNotes) => [...prevNotes, ...newNotes]);
  };

  return [notes, updatePatchNotes];
}
