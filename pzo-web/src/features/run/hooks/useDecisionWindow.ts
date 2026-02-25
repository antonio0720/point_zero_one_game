// pzo-web/src/features/run/hooks/useDecisionWindow.ts
import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { createSelector } from 'reselect';
import type { RootState } from 'pzo-web/src/store';

// Optimized selector to extract only the countdown value
const getDecisionCountdown = createSelector(
  (state: RootState) => state.timeEngine,
  (timeEngine) => timeEngine.decisionCountdown
);

export function useDecisionWindow() {
  const [countdown, setCountdown] = useState(0);
  const lastUpdateRef = useRef<number>(0);
  const isMountedRef = useRef(false);

  // Subscribe to the countdown value from the store
  const decisionCountdown = useSelector(getDecisionCountdown);

  useEffect(() => {
    const updateCountdown = () => {
      const now = performance.now();
      if (now - lastUpdateRef.current >= 100) {
        // Update local state via RAF to avoid re-renders
        setCountdown(prev => prev + 1);
        lastUpdateRef.current = now;
      }
    };

    // Initial setup
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      setCountdown(decisionCountdown);
      lastUpdateRef.current = performance.now();
      requestAnimationFrame(updateCountdown);
    }

    // Cleanup
    return () => {
      isMountedRef.current = false;
    };
  }, [decisionCountdown]);

  return { countdown };
}
