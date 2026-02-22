/**
 * IntegrityLink component for Replay pages. Ensures the integrity of the replay data by comparing a hash of the current state with a stored hash.
 */

import React, { useEffect, useState } from 'react';
import sha256 from 'sha256';
import { useLocation } from 'react-router-dom';
import { ReplayStateContext } from '../../contexts/ReplayStateContext';
import { StoredReplayIntegrity } from '../../types/StoredReplayIntegrity';

type IntegrityLinkProps = {};

const IntegrityLink: React.FC<IntegrityLinkProps> = () => {
  const location = useLocation();
  const [storedIntegrity, setStoredIntegrity] = useState<StoredReplayIntegrity | null>(null);
  const [currentIntegrity, setCurrentIntegrity] = useState<string | null>(null);
  const replayState = React.useContext(ReplayStateContext);

  useEffect(() => {
    if (!replayState) return;

    const calculateIntegrity = async () => {
      const stateHash = sha256(JSON.stringify(replayState));
      setCurrentIntegrity(stateHash);

      // Fetch stored integrity from server (not shown for brevity)
      // ...
      // Set the stored integrity state
      setStoredIntegrity({ replayId: location.state?.replayId, integrity: storedIntegrity });
    };

    calculateIntegrity();
  }, [location.state?.replayId, replayState]);

  useEffect(() => {
    if (!storedIntegrity || !currentIntegrity) return;

    // Compare the current and stored integrity hashes
    // If they match, show a message indicating the replay is valid
    // If they don't match, show an error message and provide options to refresh or report the issue
  }, [storedIntegrity, currentIntegrity]);

  return <div>Integrity Link - Loading...</div>;
};

export { IntegrityLink };
