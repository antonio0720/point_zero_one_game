/**
 * Hook for polling verification status and triggering UI state flip without reload.
 */

import { useEffect, useState } from 'react';
import axios from 'axios';

type VerificationStatus = 'PENDING' | 'VERIFIED' | 'QUARANTINED';

/**
 * Fetches the verification status and updates the state.
 */
export const useProofPolling = () => {
  const [status, setStatus] = useState<VerificationStatus>('PENDING');

  useEffect(() => {
    const pollVerifier = async () => {
      try {
        const response = await axios.get('/api/verifier/status');
        setStatus(response.data as VerificationStatus);
      } catch (error) {
        console.error('Error fetching verification status:', error);
      }
    };

    const pollExplorer = async () => {
      try {
        const response = await axios.get('/api/explorer/read-model');
        const readModel = response.data as any;
        const gameState = readModel.gameState || {};
        const proofStatus = gameState.proofStatus || 'PENDING';
        setStatus(proofStatus as VerificationStatus);
      } catch (error) {
        console.error('Error fetching game state:', error);
      }
    };

    pollVerifier();
    pollExplorer();

    const backoffJitter = (base: number, minJitter: number, maxJitter: number) =>
      Math.random() * (maxJitter - minJitter) + minJitter;

    const backoff = (currentAttempt: number, base: number, jitter: number) => {
      if (status === 'VERIFIED' || status === 'QUARANTINED') return;
      const sleepTime = Math.max(base * Math.pow(2, currentAttempt), 1000);
      setTimeout(() => {
        pollVerifier();
        pollExplorer();
      }, sleepTime + backoffJitter(sleepTime, jitter, jitter * 2));
    };

    backoff(0, 500, 500);
  }, [status]);

  return status;
};
