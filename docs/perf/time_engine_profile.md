// pzo-web/src/engines/time/DecisionTimer.ts
import { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { updateDecisionTimer } from '../store/engineStore';

export const DecisionTimer = () => {
  const [seconds, setSeconds] = useState(10);
  const dispatch = useDispatch();
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const startTimer = () => {
      timerRef.current = window.setInterval(() => {
        setSeconds(prev => prev - 1);
        dispatch(updateDecisionTimer({ seconds: prev - 1 }));
      }, 100);
    };

    startTimer();
    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
      }
    };
  }, [dispatch]);

  return null; // Timer logic is handled via store
};
